import 'maplibre-gl/dist/maplibre-gl.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { Map as MapLibreMap } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { WebMercatorViewport } from '@deck.gl/core';
import type { MapViewState } from '@deck.gl/core';
import Supercluster from 'supercluster';
import type { TileLoadProps } from '@deck.gl/geo-layers/typed/tileset-2d';

import {
  CATEGORY_OPTIONS,
  SAMPLE_POINTS,
  SAMPLE_POLYGONS,
  SAMPLE_ROUTES,
  SAMPLE_TRIPS,
  generateTilePoints,
  generateRandomPoints,
  getPolygonValueRange,
  getTripTimeRange
} from './data';
import { buildBaseLayers, buildTripsLayer } from './layers';
import { ControlPanel } from './ui/ControlPanel';
import { Legend } from './ui/Legend';
import { Tooltip, TooltipInfo } from './ui/Tooltip';
import type { ClusterFeature, LngLat, PointDatum, TilePoint } from './types';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

// Magic-number references (documented for clarity + tuning).
const DEFAULT_VIEW_STATE: MapViewState = {
  // SF downtown focus for demo.
  longitude: -122.406417,
  latitude: 37.785834,
  zoom: 12.5,
  pitch: 40,
  bearing: -10
};
const LARGE_DATASET_COUNT = 10000; // 10k points for perf testing.
const CLUSTER_RADIUS_PX = 60; // Supercluster radius in pixels.
const CLUSTER_MAX_ZOOM = 16; // Stop clustering beyond this zoom.
const TRIPS_LOOP_DURATION_MS = 18000; // Full trip playback loop duration.
const FPS_SAMPLE_WINDOW_MS = 1000; // FPS update interval.
const TILE_COUNT_MIN = 24; // Min tile points per tile (low zoom).
const TILE_COUNT_MAX = 100; // Max tile points per tile (high zoom).
const TILE_COUNT_ZOOM_OFFSET = 10; // Zoom offset before tiles densify.
const TILE_COUNT_ZOOM_SCALE = 18; // Points added per zoom step.
const TRIPS_TRAIL_MIN_MS = 20000; // Minimum trail length for visibility.
const TRIPS_TRAIL_FRACTION = 0.35; // Fraction of trip duration used for trail.
const FOCUS_ZOOM_MIN = 14; // Zoom level when focusing a clicked feature.
const FOCUS_TRANSITION_MS = 800; // Camera transition duration.

function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

function getFocusPosition(object: any, layerId: string | null): LngLat | null {
  if (!object || !layerId) {
    return null;
  }

  if (layerId === 'points') {
    if (object.position) {
      return object.position as LngLat;
    }
    if (object.geometry?.coordinates) {
      return object.geometry.coordinates as LngLat;
    }
  }

  if (layerId === 'polygons') {
    return object.properties?.centroid ?? null;
  }

  if (layerId === 'routes') {
    const coords = object.geometry?.coordinates ?? [];
    if (coords.length > 0) {
      return coords[Math.floor(coords.length / 2)] as LngLat;
    }
  }

  if (layerId === 'trips') {
    return object.path?.[0]?.coordinates ?? null;
  }

  if (layerId === 'hexagon') {
    return object.position ?? null;
  }

  return null;
}

export default function App() {
  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_VIEW_STATE);

  const size = useWindowSize();
  const [hoverInfo, setHoverInfo] = useState<TooltipInfo | null>(null);
  const [fps, setFps] = useState(0);

  const [showPoints, setShowPoints] = useState(true);
  const [showPolygons, setShowPolygons] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showTrips, setShowTrips] = useState(true);
  const [showHexagon, setShowHexagon] = useState(false);
  const [clusterEnabled, setClusterEnabled] = useState(true);
  const [useLargeDataset, setUseLargeDataset] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_OPTIONS[0]);
  const effectiveShowPoints = showHexagon ? false : showPoints;

  useEffect(() => {
    if (showHexagon && showPoints) {
      setShowPoints(false);
    }
  }, [showHexagon, showPoints]);

  const largePoints = useMemo(() => generateRandomPoints(LARGE_DATASET_COUNT), []);
  const activePoints = useMemo(() => {
    const points = useLargeDataset ? largePoints : SAMPLE_POINTS;
    if (categoryFilter === 'all') {
      return points;
    }
    return points.filter((point) => point.category === categoryFilter);
  }, [useLargeDataset, largePoints, categoryFilter]);

  const clusterPoints = useMemo<Supercluster.PointFeature<PointDatum>[]>(() => {
    return activePoints.map((point) => ({
      type: 'Feature' as const,
      properties: {
        ...point
      },
      geometry: {
        type: 'Point' as const,
        coordinates: point.position
      }
    }));
  }, [activePoints]);

  const clusterIndex = useMemo(() => {
    const index = new Supercluster({
      radius: CLUSTER_RADIUS_PX,
      maxZoom: CLUSTER_MAX_ZOOM
    });
    index.load(clusterPoints);
    return index;
  }, [clusterPoints]);

  const bounds = useMemo(() => {
    const viewport = new WebMercatorViewport({
      ...viewState,
      width: size.width,
      height: size.height
    });
    return viewport.getBounds();
  }, [viewState, size]);

  const clusters = useMemo(() => {
    try {
      if (!clusterEnabled) {
        return [] as ClusterFeature[];
      }

      const result = clusterIndex.getClusters(
        bounds as [number, number, number, number],
        Math.round(viewState.zoom)
      );
      return (result || []) as ClusterFeature[] | [];
    } catch (error) {
      console.error('Clustering failed:', error);
      return [] as ClusterFeature[];
    }
  }, [clusterEnabled, clusterIndex, bounds, viewState.zoom]);

  const choroplethRange = useMemo(() => getPolygonValueRange(SAMPLE_POLYGONS), []);
  const tripRange = useMemo(() => getTripTimeRange(SAMPLE_TRIPS), []);

  const [currentTime, setCurrentTime] = useState(tripRange.start);
  const [isPlaying, setIsPlaying] = useState(false);
  const tileCacheRef = useRef(new Map<string, TilePoint[]>());
  const [tileCacheCount, setTileCacheCount] = useState(0);
  const currentTimeRef = useRef(currentTime);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }

    const duration = tripRange.end - tripRange.start;
    if (duration <= 0) {
      return undefined;
    }

    let animationFrame = 0;
    let last = performance.now();
    const loopDuration = TRIPS_LOOP_DURATION_MS;
    const speed = duration / loopDuration;

    const step = (now: number) => {
      const delta = now - last;
      last = now;
      let nextTime = currentTimeRef.current + delta * speed;
      if (nextTime > tripRange.end) {
        nextTime = tripRange.start + ((nextTime - tripRange.start) % duration);
      }
      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);
      animationFrame = requestAnimationFrame(step);
    };

    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, tripRange.end, tripRange.start]);

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let last = performance.now();

    const loop = (now: number) => {
      frames += 1;
      if (now - last >= FPS_SAMPLE_WINDOW_MS) {
        setFps(Math.round((frames * FPS_SAMPLE_WINDOW_MS) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);


  const getTileData = useCallback(
    (tile: TileLoadProps) => {
      try {
        if (!('west' in tile.bbox)) {
          return [];
        }

        const key = `${tile.index.z}/${tile.index.x}/${tile.index.y}`;
        const cached = tileCacheRef.current.get(key);
        if (cached) {
          return cached;
        }

        const bbox: [number, number, number, number] = [
          tile.bbox.west,
          tile.bbox.south,
          tile.bbox.east,
          tile.bbox.north
        ];
        const zoom = tile.index?.z ?? 0;
        const count = Math.min(
          TILE_COUNT_MAX,
          Math.max(TILE_COUNT_MIN, Math.round((zoom - TILE_COUNT_ZOOM_OFFSET) * TILE_COUNT_ZOOM_SCALE))
        );
        const points = generateTilePoints(bbox, count, key);
        tileCacheRef.current.set(key, points);
        setTileCacheCount((previous) => {
          const next = tileCacheRef.current.size;
          return previous === next ? previous : next;
        });
        return points;
      } catch (error) {
        console.error('Tile generation failed:', error);
        return [];
      }
    },
    [setTileCacheCount]
  );

  const handleTileLoad = useCallback(() => {
    setTileCacheCount(tileCacheRef.current.size);
  }, [setTileCacheCount]);

  const baseLayers = useMemo(() => {
    return buildBaseLayers({
      points: activePoints,
      clusters,
      polygons: SAMPLE_POLYGONS,
      routes: SAMPLE_ROUTES,
      showPoints: effectiveShowPoints,
      showClusters: clusterEnabled,
      showPolygons,
      showRoutes,
      showHexagon,
      getTileData,
      onTileLoad: handleTileLoad,
      choroplethMin: choroplethRange.min,
      choroplethMax: choroplethRange.max
    });
  }, [
    activePoints,
    clusters,
    effectiveShowPoints,
    clusterEnabled,
    showPolygons,
    showRoutes,
    showHexagon,
    getTileData,
    handleTileLoad,
    choroplethRange.min,
    choroplethRange.max
  ]);

  const tripDuration = tripRange.end - tripRange.start;
  const trailLength = Math.max(TRIPS_TRAIL_MIN_MS, tripDuration * TRIPS_TRAIL_FRACTION);

  const tripsLayer = useMemo(
    () =>
      buildTripsLayer({
        trips: SAMPLE_TRIPS,
        showTrips,
        currentTime,
        timeOffset: tripRange.start,
        trailLength
      }),
    [showTrips, currentTime, tripRange.start, trailLength]
  );

  const layers = useMemo(() => {
    if (!tripsLayer) {
      return baseLayers;
    }
    return [...baseLayers, tripsLayer];
  }, [baseLayers, tripsLayer]);

  const handleHover = useCallback((info: any) => {
    if (!info.object) {
      setHoverInfo(null);
      return;
    }

    setHoverInfo({
      x: info.x,
      y: info.y,
      object: info.object,
      layerId: info.layer?.id ?? null
    });
  }, []);

  const handleClick = useCallback(
    (info: any) => {
      if (!info.object) {
        return;
      }

      const target = getFocusPosition(info.object, info.layer?.id ?? null);
      if (!target) {
        return;
      }

      setViewState((previous) => ({
        ...previous,
        longitude: target[0],
        latitude: target[1],
        zoom: Math.max(previous.zoom, FOCUS_ZOOM_MIN),
        transitionDuration: FOCUS_TRANSITION_MS
      }));
    },
    [setViewState]
  );

  const focusSummary = useMemo(() => {
    if (!hoverInfo?.object || !hoverInfo.layerId) {
      return null;
    }

    const obj = hoverInfo.object as any;
    if (hoverInfo.layerId === 'points') {
      if (obj.properties?.cluster) {
        return {
          title: 'Cluster Focus',
          items: [`Points: ${obj.properties.point_count ?? 0}`]
        };
      }
      return {
        title: `Point ${obj.id ?? obj.properties?.id ?? ''}`,
        items: [
          `Category: ${obj.category ?? obj.properties?.category ?? ''}`,
          `Rating: ${obj.rating ?? obj.properties?.rating ?? ''}`
        ]
      };
    }

    if (hoverInfo.layerId === 'polygons') {
      return {
        title: `Region ${obj.properties?.region ?? ''}`,
        items: [`Value: ${obj.properties?.value ?? ''}`]
      };
    }

    if (hoverInfo.layerId === 'routes') {
      return {
        title: 'Route Flow',
        items: [
          `From: ${obj.properties?.from ?? ''}`,
          `To: ${obj.properties?.to ?? ''}`,
          `Volume: ${obj.properties?.volume ?? ''}`
        ]
      };
    }

    if (hoverInfo.layerId === 'trips') {
      return {
        title: 'Trip',
        items: [`Vehicle: ${obj.vendor ?? ''}`]
      };
    }

    if (hoverInfo.layerId === 'hexagon') {
      const points = obj.points ?? [];
      return {
        title: 'Hexagon Bin',
        items: [`Points: ${points.length}`]
      };
    }

    return null;
  }, [hoverInfo]);

  return (
    <div className="app">
      <div className="map-shell">
        <DeckGL
          viewState={viewState}
          onViewStateChange={({ viewState: nextViewState }) => setViewState(nextViewState as MapViewState)}
          controller={{ dragRotate: false, touchRotate: false }}
          layers={layers}
          onHover={handleHover}
          onClick={handleClick}
        >
          <MapLibreMap mapLib={maplibregl} mapStyle={MAP_STYLE} reuseMaps />
        </DeckGL>
      </div>

      <ControlPanel
        showPoints={showPoints}
        setShowPoints={setShowPoints}
        showPolygons={showPolygons}
        setShowPolygons={setShowPolygons}
        showRoutes={showRoutes}
        setShowRoutes={setShowRoutes}
        showTrips={showTrips}
        setShowTrips={setShowTrips}
        showHexagon={showHexagon}
        setShowHexagon={setShowHexagon}
        clusterEnabled={clusterEnabled}
        setClusterEnabled={setClusterEnabled}
        useLargeDataset={useLargeDataset}
        setUseLargeDataset={setUseLargeDataset}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        currentTime={currentTime}
        minTime={tripRange.start}
        maxTime={tripRange.end}
        setCurrentTime={setCurrentTime}
      />

      <div className="info-panel">
        <div className="info-header">
          <span className="info-kicker">Live Insights</span>
        </div>
        <div className="info-metrics">
          <div className="metric">
            <span className="metric-label">Active Points</span>
            <span className="metric-value">{activePoints.length}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Clusters</span>
            <span className="metric-value">{clusterEnabled ? clusters.length : 0}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Trips</span>
            <span className="metric-value">{SAMPLE_TRIPS.length}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Tile Cache</span>
            <span className="metric-value">{tileCacheCount}</span>
          </div>
          <div className="metric">
            <span className="metric-label">FPS</span>
            <span className="metric-value">{fps}</span>
          </div>
        </div>
        <div className="info-card">
          <span className="info-card-title">{focusSummary?.title ?? 'Hover a layer'}</span>
          <div className="info-card-body">
            {(focusSummary?.items ?? ['Use hover to inspect points, routes, and polygons.']).map((line) => (
              <div key={line} className="info-card-line">
                {line}
              </div>
            ))}
          </div>
        </div>
       
      </div>

      <Legend min={choroplethRange.min} max={choroplethRange.max} />
      <Tooltip info={hoverInfo} />
    </div>
  );
}
