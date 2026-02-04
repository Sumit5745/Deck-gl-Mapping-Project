export type LngLat = [number, number];

export type FeatureCollection<T> = {
  type: 'FeatureCollection';
  features: T[];
};

export type PointDatum = {
  id: string;
  category: string;
  rating: number;
  position: LngLat;
};

export type PolygonFeature = {
  type: 'Feature';
  properties: {
    region: string;
    value: number;
    centroid: LngLat;
  };
  geometry: {
    type: 'Polygon';
    coordinates: LngLat[][];
  };
};

export type RouteFeature = {
  type: 'Feature';
  properties: {
    from: string;
    to: string;
    volume: number;
  };
  geometry: {
    type: 'LineString';
    coordinates: LngLat[];
  };
};

export type TripPoint = {
  coordinates: LngLat;
  timestamp: number;
};

export type TripDatum = {
  vendor: string;
  path: TripPoint[];
};

export type TilePoint = {
  position: LngLat;
  intensity: number;
};

export type ClusterFeature = {
  type: 'Feature';
  properties: {
    cluster?: boolean;
    point_count?: number;
    point_count_abbreviated?: string;
    [key: string]: unknown;
  };
  geometry: {
    type: 'Point';
    coordinates: LngLat;
  };
};
