import { ArcLayer, GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
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

export function getCategoryColor(category: string): [number, number, number, number] {
  const rgb = CATEGORY_COLORS[category] ?? [148, 163, 184];
  return [...rgb, 200];
}

export function getClusterColor(count: number): [number, number, number, number] {
  if (count > 100) {
    return [99, 102, 241, 220];
  }
  if (count > 50) {
    return [59, 130, 246, 220];
  }
  if (count > 20) {
    return [14, 165, 233, 220];
  }
  return [56, 189, 248, 200];
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
  const start: [number, number, number] = [226, 232, 240];
  const end: [number, number, number] = [52, 211, 153];

  const r = Math.round(start[0] + (end[0] - start[0]) * t);
  const g = Math.round(start[1] + (end[1] - start[1]) * t);
  const b = Math.round(start[2] + (end[2] - start[2]) * t);

  return [r, g, b, 200];
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
        getLineColor: [15, 23, 42, 150],
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
        getWidth: (feature: RouteFeature) => Math.max(2, feature.properties.volume / 15),
        widthMinPixels: 2,
        getSourceColor: [59, 130, 246, 200],
        getTargetColor: [250, 204, 21, 200]
      })
    );
  }

  if (params.showPoints) {
    const data = params.showClusters ? params.clusters : params.points;
    const pointOpacity = params.showHexagon ? 0.12 : 1;
    const clusterScale = params.showHexagon ? 1.2 : 4;
    const pointRadius = params.showHexagon ? 3 : 6;

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
        getLineColor: [15, 23, 42, 180],
        lineWidthMinPixels: params.showHexagon ? 0 : 1
      })
    );
  }

  layers.push(
    new TileLayer<TilePoint[]>({
      id: 'tile-layer',
      data: 'tile-cache',
      pickable: false,
      tileSize: 256,
      maxCacheSize: 180,
      maxRequests: 8,
      getTileData: params.getTileData,
      renderSubLayers: () => null
    })
  );

  if (params.showHexagon) {
    layers.push(
      new HexagonLayer<PointDatum>({
        id: 'hexagon',
        data: params.points,
        pickable: true,
        extruded: true,
        radius: 180,
        coverage: 0.9,
        elevationScale: 50,
        opacity: 0.8,
        getPosition: (item) => item.position,
        getColorWeight: (item) => item.rating,
        colorAggregation: 'MEAN',
        getElevationWeight: 1,
        elevationAggregation: 'SUM',
        colorRange: [
          [255, 247, 237],
          [254, 215, 170],
          [253, 186, 116],
          [249, 115, 22],
          [234, 88, 12]
        ],
        material: {
          ambient: 0.2,
          diffuse: 0.7,
          shininess: 16,
          specularColor: [255, 255, 255]
        },
        parameters: {
          depthTest: false
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
    getPath: (trip): PathGeometry => trip.path.map((point) => [point[0], point[1]]) as unknown as PathGeometry,
    getTimestamps: (trip) => trip.path.map((point) => point[2] - params.timeOffset),
    getColor: [14, 116, 144],
    opacity: 0.9,
    widthMinPixels: 3,
    trailLength: params.trailLength,
    currentTime: params.currentTime - params.timeOffset,
    fadeTrail: true,
    rounded: true
  });
}
