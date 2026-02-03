import { ClusterFeature, FeatureCollection, PointDatum, PolygonFeature, RouteFeature, TilePoint, TripDatum } from './types';

export const CATEGORY_OPTIONS = ['all', 'restaurant', 'cafe', 'museum', 'park', 'shop'];

export const SAMPLE_POINTS: PointDatum[] = [
  {
    id: 'p1',
    category: 'restaurant',
    rating: 4.2,
    position: [-122.406417, 37.785834]
  },
  {
    id: 'p2',
    category: 'cafe',
    rating: 4.8,
    position: [-122.412345, 37.781122]
  },
  {
    id: 'p3',
    category: 'museum',
    rating: 4.6,
    position: [-122.399245, 37.792134]
  }
];

export const SAMPLE_POLYGONS: FeatureCollection<PolygonFeature> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        region: 'north',
        value: 120,
        centroid: [-122.41, 37.795]
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-122.42, 37.8],
            [-122.4, 37.8],
            [-122.4, 37.79],
            [-122.42, 37.79],
            [-122.42, 37.8]
          ]
        ]
      }
    },
    {
      type: 'Feature',
      properties: {
        region: 'south',
        value: 75,
        centroid: [-122.41, 37.785]
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-122.42, 37.79],
            [-122.4, 37.79],
            [-122.4, 37.78],
            [-122.42, 37.78],
            [-122.42, 37.79]
          ]
        ]
      }
    }
  ]
};

export const SAMPLE_ROUTES: FeatureCollection<RouteFeature> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        from: 'p1',
        to: 'p2',
        volume: 120
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.406417, 37.785834],
          [-122.412345, 37.781122]
        ]
      }
    },
    {
      type: 'Feature',
      properties: {
        from: 'p2',
        to: 'p3',
        volume: 40
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.412345, 37.781122],
          [-122.399245, 37.792134]
        ]
      }
    }
  ]
};

export const SAMPLE_TRIPS: TripDatum[] = [
  {
    vendor: 'vehicle-1',
    path: [
      [-122.406417, 37.785834, 1672531200000],
      [-122.404, 37.7865, 1672531260000],
      [-122.401, 37.788, 1672531320000]
    ]
  },
  {
    vendor: 'vehicle-2',
    path: [
      [-122.412345, 37.781122, 1672531200000],
      [-122.41, 37.783, 1672531260000],
      [-122.4075, 37.785, 1672531320000]
    ]
  }
];

export type PointsBbox = [number, number, number, number];

export function generateRandomPoints(
  count: number,
  bbox: PointsBbox = [-122.42, 37.78, -122.39, 37.8],
  categories: string[] = CATEGORY_OPTIONS.filter((item) => item !== 'all')
): PointDatum[] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const points: PointDatum[] = [];

  for (let i = 0; i < count; i += 1) {
    const lng = Math.random() * (maxLng - minLng) + minLng;
    const lat = Math.random() * (maxLat - minLat) + minLat;
    const category = categories[i % categories.length];
    const rating = Math.round(Math.random() * 50) / 10;

    points.push({
      id: `p${i}`,
      category,
      rating,
      position: [lng, lat]
    });
  }

  return points;
}

function hashSeed(value: string | number): number {
  const text = String(value);
  let hash = 2166136261;

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateTilePoints(
  bbox: PointsBbox,
  count = 120,
  seedKey: string | number = 'tile-seed'
): TilePoint[] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const random = createSeededRandom(hashSeed(seedKey));
  const points: TilePoint[] = [];

  for (let i = 0; i < count; i += 1) {
    const lng = random() * (maxLng - minLng) + minLng;
    const lat = random() * (maxLat - minLat) + minLat;
    const intensity = Math.round(random() * 100) / 100;

    points.push({
      position: [lng, lat],
      intensity
    });
  }

  return points;
}

export function getTripTimeRange(trips: TripDatum[]): { start: number; end: number } {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;

  trips.forEach((trip) => {
    trip.path.forEach((point) => {
      const time = point[2];
      start = Math.min(start, time);
      end = Math.max(end, time);
    });
  });

  return { start, end };
}

export function getPolygonValueRange(polygons: FeatureCollection<PolygonFeature>): {
  min: number;
  max: number;
} {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  polygons.features.forEach((feature) => {
    min = Math.min(min, feature.properties.value);
    max = Math.max(max, feature.properties.value);
  });

  return { min, max };
}

export function isClusterFeature(feature: ClusterFeature): boolean {
  return Boolean(feature.properties.cluster);
}
