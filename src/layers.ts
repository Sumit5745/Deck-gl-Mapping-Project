import { ArcLayer, GeoJsonLayer, ScatterplotLayer, SolidPolygonLayer } from '@deck.gl/layers';
import { TileLayer, TripsLayer } from '@deck.gl/geo-layers';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import type { Layer } from '@deck.gl/core';
import type { PathGeometry } from '@deck.gl/layers/typed/path-layer/path';
import type { TileLoadProps } from '@deck.gl/geo-layers/typed/tileset-2d';

import {
  ClusterFeature,
  FeatureCollection,
  PointDatum,
  PolygonFeature,
  RouteFeature,
  TilePoint,
  TripDatum
} from './types';
import { isClusterFeature } from './data';

export const CATEGORY_COLORS: Record<string, [number, number, number]> = {
  restaurant: [255, 107, 107],
  cafe: [77, 171, 247],
  museum: [255, 209, 102],
  park: [160, 217, 149],
  shop: [162, 155, 254]
};

// Magic-number references .
const CATEGORY_ALPHA = 200; // Default point alpha channel.
const CLUSTER_COLOR_THRESHOLDS = [100, 50, 20]; // Count thresholds for cluster colors.
const CLUSTER_COLORS: [number, number, number, number][] = [
  [99, 102, 241, 220],
  [59, 130, 246, 220],
  [14, 165, 233, 220],
  [56, 189, 248, 200]
];
const CHORO_START: [number, number, number] = [226, 232, 240];
const CHORO_END: [number, number, number] = [52, 211, 153];
const CHORO_ALPHA = 200;
const POLY_LINE_COLOR: [number, number, number, number] = [15, 23, 42, 150];
const ROUTE_WIDTH_SCALE = 15; // Volume divisor to scale arc width.
const ROUTE_WIDTH_MIN = 2; // Minimum visible arc width.
const ROUTE_SOURCE_COLOR: [number, number, number, number] = [59, 130, 246, 200];
const ROUTE_TARGET_COLOR: [number, number, number, number] = [250, 204, 21, 200];
const POINT_OPACITY_HEX = 0.12; // Dim points so hexagons are visible.
const POINT_OPACITY_DEFAULT = 1;
const CLUSTER_SCALE_HEX = 1.2;
const CLUSTER_SCALE_DEFAULT = 4;
const POINT_RADIUS_HEX = 3;
const POINT_RADIUS_DEFAULT = 6;
const POINT_STROKE_COLOR: [number, number, number, number] = [15, 23, 42, 180];
const TILE_SIZE_PX = 256;
const TILE_CACHE_MAX = 180;
const TILE_MAX_REQUESTS = 8;
const HEX_RADIUS = 180; // meters
const HEX_COVERAGE = 0.9;
const HEX_ELEVATION_SCALE = 50;
const HEX_OPACITY = 0.8;
const HEX_COLOR_RANGE: [number, number, number][] = [
  [255, 247, 237],
  [254, 215, 170],
  [253, 186, 116],
  [249, 115, 22],
  [234, 88, 12]
];
const HEX_MATERIAL: {
  ambient: number;
  diffuse: number;
  shininess: number;
  specularColor: [number, number, number];
} = {
  ambient: 0.2,
  diffuse: 0.7,
  shininess: 16,
  specularColor: [255, 255, 255]
};
const TRIPS_COLOR: [number, number, number] = [14, 116, 144];
const TRIPS_OPACITY = 0.9;
const TRIPS_WIDTH_MIN = 3;

export function getCategoryColor(category: string): [number, number, number, number] {
  const rgb = CATEGORY_COLORS[category] ?? [148, 163, 184];
  return [...rgb, CATEGORY_ALPHA];
}

export function getClusterColor(count: number): [number, number, number, number] {
  if (count > CLUSTER_COLOR_THRESHOLDS[0]) {
    return CLUSTER_COLORS[0];
  }
  if (count > CLUSTER_COLOR_THRESHOLDS[1]) {
    return CLUSTER_COLORS[1];
  }
  if (count > CLUSTER_COLOR_THRESHOLDS[2]) {
    return CLUSTER_COLORS[2];
  }
  return CLUSTER_COLORS[3];
}

export function getChoroplethColor(
  value: number,
  min: number,
  max: number
): [number, number, number, number] {
  if (max === min) {
    return [160, 217, 149, 200];
  }

  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const start: [number, number, number] = CHORO_START;
  const end: [number, number, number] = CHORO_END;

  const r = Math.round(start[0] + (end[0] - start[0]) * t);
  const g = Math.round(start[1] + (end[1] - start[1]) * t);
  const b = Math.round(start[2] + (end[2] - start[2]) * t);

  return [r, g, b, CHORO_ALPHA];
}

export type BaseLayersParams = {
  points: PointDatum[];
  clusters: ClusterFeature[];
  polygons: FeatureCollection<PolygonFeature>;
  routes: FeatureCollection<RouteFeature>;
  showPoints: boolean;
  showClusters: boolean;
  showPolygons: boolean;
  showRoutes: boolean;
  showHexagon: boolean;
  getTileData: (tile: TileLoadProps) => TilePoint[] | Promise<TilePoint[]>;
  onTileLoad?: (tile: unknown) => void;
  choroplethMin: number;
  choroplethMax: number;
};

export type TripsLayerParams = {
  trips: TripDatum[];
  showTrips: boolean;
  currentTime: number;
  timeOffset: number;
  trailLength: number;
};

export function buildBaseLayers(params: BaseLayersParams): Layer[] {
  const layers: Layer[] = [];

  if (params.showPolygons) {
    layers.push(
      new GeoJsonLayer<PolygonFeature>({
        id: 'polygons',
        data: params.polygons,
        pickable: true,
        stroked: true,
        filled: true,
        getFillColor: (feature) =>
          getChoroplethColor(feature.properties?.value ?? 0, params.choroplethMin, params.choroplethMax),
        getLineColor: POLY_LINE_COLOR,
        lineWidthMinPixels: 1
      })
    );
  }

  if (params.showRoutes) {
    layers.push(
      new ArcLayer({
        id: 'routes',
        data: params.routes.features,
        pickable: true,
        widthUnits: 'pixels',
        getSourcePosition: (feature: RouteFeature) => feature.geometry.coordinates[0],
        getTargetPosition: (feature: RouteFeature) =>
          feature.geometry.coordinates[feature.geometry.coordinates.length - 1],
        getWidth: (feature: RouteFeature) => Math.max(ROUTE_WIDTH_MIN, feature.properties.volume / ROUTE_WIDTH_SCALE),
        widthMinPixels: ROUTE_WIDTH_MIN,
        getSourceColor: ROUTE_SOURCE_COLOR,
        getTargetColor: ROUTE_TARGET_COLOR
      })
    );
  }

  if (params.showPoints) {
    const data = params.showClusters ? params.clusters : params.points;
    const pointOpacity = params.showHexagon ? POINT_OPACITY_HEX : POINT_OPACITY_DEFAULT;
    const clusterScale = params.showHexagon ? CLUSTER_SCALE_HEX : CLUSTER_SCALE_DEFAULT;
    const pointRadius = params.showHexagon ? POINT_RADIUS_HEX : POINT_RADIUS_DEFAULT;

    layers.push(
      new ScatterplotLayer<PointDatum | ClusterFeature>({
        id: 'points',
        data,
        pickable: true,
        opacity: pointOpacity,
        radiusUnits: 'pixels',
        getPosition: (item: PointDatum | ClusterFeature) => {
          if ('geometry' in item) {
            return item.geometry.coordinates;
          }
          return item.position;
        },
        getRadius: (item: PointDatum | ClusterFeature) => {
          if ('geometry' in item && isClusterFeature(item)) {
            const count = item.properties.point_count ?? 1;
            return Math.max(10, Math.sqrt(count) * clusterScale);
          }
          return pointRadius;
        },
        getFillColor: (item) => {
          if ('geometry' in item && isClusterFeature(item)) {
            const count = item.properties.point_count ?? 1;
            return getClusterColor(count);
          }
          const category = ('category' in item ? item.category : item.properties?.category) as
            | string
            | undefined;
          return getCategoryColor(category ?? '');
        },
        getLineColor: POINT_STROKE_COLOR,
        lineWidthMinPixels: params.showHexagon ? 0 : 1
      })
    );
  }

  layers.push(
    new TileLayer<TilePoint[]>({
      id: 'tile-layer',
      data: 'tile-cache',
      pickable: false,
      tileSize: TILE_SIZE_PX,
      maxCacheSize: TILE_CACHE_MAX,
      maxRequests: TILE_MAX_REQUESTS,
      getTileData: params.getTileData,
      onTileLoad: params.onTileLoad,
      renderSubLayers: (subLayerProps) => {
        const { tile, id } = subLayerProps;
        const bbox = tile?.bbox as { west: number; south: number; east: number; north: number } | undefined;
        if (!bbox || !('west' in bbox)) {
          return null;
        }

        const polygon = [
          [
            [bbox.west, bbox.south],
            [bbox.east, bbox.south],
            [bbox.east, bbox.north],
            [bbox.west, bbox.north],
            [bbox.west, bbox.south]
          ]
        ];

        return new SolidPolygonLayer({
          id: `${id}-grid`,
          data: [polygon],
          getPolygon: (item) => item,
          stroked: true,
          filled: false,
          lineWidthMinPixels: 1,
          getLineColor: [15, 23, 42, 50]
        });
      }
    })
  );

  if (params.showHexagon) {
    layers.push(
      new HexagonLayer<PointDatum>({
        id: 'hexagon',
        data: params.points,
        pickable: true,
        extruded: true,
        radius: HEX_RADIUS,
        coverage: HEX_COVERAGE,
        elevationScale: HEX_ELEVATION_SCALE,
        opacity: HEX_OPACITY,
        getPosition: (item) => item.position,
        getColorWeight: (item) => item.rating,
        colorAggregation: 'MEAN',
        getElevationWeight: 1,
        elevationAggregation: 'SUM',
        colorRange: HEX_COLOR_RANGE,
        material: HEX_MATERIAL,
        parameters: {
          depthTest: true
        }
      })
    );
  }

  return layers;
}

export function buildTripsLayer(params: TripsLayerParams): Layer | null {
  if (!params.showTrips) {
    return null;
  }

  return new TripsLayer<TripDatum>({
    id: 'trips',
    data: params.trips,
    getPath: (trip): PathGeometry =>
      trip.path.map((point) => [point.coordinates[0], point.coordinates[1]]) as unknown as PathGeometry,
    getTimestamps: (trip) => trip.path.map((point) => point.timestamp - params.timeOffset),
    getColor: TRIPS_COLOR,
    opacity: TRIPS_OPACITY,
    widthMinPixels: TRIPS_WIDTH_MIN,
    trailLength: params.trailLength,
    currentTime: params.currentTime - params.timeOffset,
    fadeTrail: true,
    rounded: true
  });
}
