# Deck.gl Mapping Task

A compact, production-minded Deck.gl demo that covers points + clustering, choropleth polygons with legend, routes, animated trips, and hexagon aggregation. It uses MapLibre for a token-free basemap and includes a 10k point generator for performance testing.

## What You Can Demo

- Points (ScatterplotLayer) with clustering toggle
- Choropleth polygons (GeoJsonLayer) with dynamic legend
- Routes/flows (ArcLayer) with width by volume
- Animated trips (TripsLayer) with play/pause + scrub
- Hexagon aggregation (HexagonLayer) for density
- Tooltip hover + click-to-focus camera

## Quick Start

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Basemap

This demo uses MapLibre + a public Carto basemap, so **no Mapbox token is required**.

## Controls (UI)

- Toggle layers on/off
- Switch between sample points and 10k generated points
- Filter by category
- Turn clustering on/off
- Play/pause + scrub trip animation time

## Data Notes

- Sample points, polygons, routes, and trips are embedded in `src/data.ts`.
- A 10k point generator uses a San Francisco-ish bbox.

## Thumbnails (From the Spec)

![points+polygon](data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='360' height='140'><rect width='100%25' height='100%25' fill='%23eef2f7'/><circle cx='80' cy='70' r='8' fill='%23ff6b6b'/><circle cx='150' cy='50' r='12' fill='%234dabf7'/><rect x='220' y='30' width='80' height='80' fill='%23a0d995' rx='8'/><text x='10' y='130' font-size='12' fill='%23333'>Points Choropleth Legend</text></svg>)

![trips](data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='360' height='140'><rect width='100%25' height='100%25' fill='%230f1724'/><path d='M40 110 C80 80 140 60 180 40' stroke='%23ffd166' stroke-width='3' fill='none'/><circle cx='50' cy='105' r='5' fill='%23ff6b6b'/><text x='200' y='80' font-size='12' fill='%23fff'>Animated (play/pause scrub)</text></svg>)

## Design Notes + Tradeoffs

This project keeps all heavy data derivations (`useMemo` for 10k points, clustering, bounds) and uses a tight layer builder to avoid re-creating layers unnecessarily. Clustering is client-side via Supercluster to avoid server dependencies; it trades absolute accuracy at high zooms for a clean, responsive demo. Trips animation uses a simple `requestAnimationFrame` loop for clarity and control instead of a more complex timeline controller. The UI prioritizes quick inspection (toggles, scrubber, tooltips) over deep analysis views to fit a small interview scope.

## Repo Structure

- `src/App.tsx`: state + view logic
- `src/layers.ts`: Deck.gl layer configuration
- `src/data.ts`: sample data + generator
- `src/ui/*`: UI components (panel, legend, tooltip)
