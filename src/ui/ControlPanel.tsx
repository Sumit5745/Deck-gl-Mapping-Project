import { CATEGORY_OPTIONS } from '../data';

export type ControlPanelProps = {
  showPoints: boolean;
  setShowPoints: (value: boolean) => void;
  showPolygons: boolean;
  setShowPolygons: (value: boolean) => void;
  showRoutes: boolean;
  setShowRoutes: (value: boolean) => void;
  showTrips: boolean;
  setShowTrips: (value: boolean) => void;
  showHexagon: boolean;
  setShowHexagon: (value: boolean) => void;
  clusterEnabled: boolean;
  setClusterEnabled: (value: boolean) => void;
  useLargeDataset: boolean;
  setUseLargeDataset: (value: boolean) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  isPlaying: boolean;
  setIsPlaying: (value: boolean) => void;
  currentTime: number;
  minTime: number;
  maxTime: number;
  setCurrentTime: (value: number) => void;
};

export function ControlPanel(props: ControlPanelProps) {
  return (
    <aside
      className="panel"
      onWheel={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div className="panel-hero">
        <div className="panel-title">Deck.gl Mapping</div>
      </div>
      <p className="panel-subtitle">Toggle layers, filter points, and scrub trips.</p>

      <div className="panel-section panel-card">
        <div className="panel-header">
          <h2>Layers</h2>
          <span className="panel-pill">Live</span>
        </div>
        <div className="panel-grid">
          <label className="toggle-row">
            <span>Points</span>
            <span className="toggle">
              <input
                type="checkbox"
                checked={props.showPoints}
                onChange={(event) => props.setShowPoints(event.target.checked)}
              />
              <span className="toggle-ui" />
            </span>
          </label>
          <label className="toggle-row">
            <span>Choropleth</span>
            <span className="toggle">
              <input
                type="checkbox"
                checked={props.showPolygons}
                onChange={(event) => props.setShowPolygons(event.target.checked)}
              />
              <span className="toggle-ui" />
            </span>
          </label>
          <label className="toggle-row">
            <span>Routes</span>
            <span className="toggle">
              <input
                type="checkbox"
                checked={props.showRoutes}
                onChange={(event) => props.setShowRoutes(event.target.checked)}
              />
              <span className="toggle-ui" />
            </span>
          </label>
          <label className="toggle-row">
            <span>Trips</span>
            <span className="toggle">
              <input
                type="checkbox"
                checked={props.showTrips}
                onChange={(event) => props.setShowTrips(event.target.checked)}
              />
              <span className="toggle-ui" />
            </span>
          </label>
          <label className="toggle-row">
            <span>Hexagon</span>
            <span className="toggle">
              <input
                type="checkbox"
                checked={props.showHexagon}
                onChange={(event) => props.setShowHexagon(event.target.checked)}
              />
              <span className="toggle-ui" />
            </span>
          </label>
        </div>
      </div>

      <div className="panel-section panel-card">
        <div className="panel-header">
          <h2>Point Controls</h2>
          <span className="panel-pill">Filters</span>
        </div>
        <label className="toggle-row">
          <span>Cluster Points</span>
          <span className="toggle">
            <input
              type="checkbox"
              checked={props.clusterEnabled}
              onChange={(event) => props.setClusterEnabled(event.target.checked)}
            />
            <span className="toggle-ui" />
          </span>
        </label>
        <label className="toggle-row">
          <span>Use 10k Dataset</span>
          <span className="toggle">
            <input
              type="checkbox"
              checked={props.useLargeDataset}
              onChange={(event) => props.setUseLargeDataset(event.target.checked)}
            />
            <span className="toggle-ui" />
          </span>
        </label>
        <label className="field">
          <span>Category</span>
          <select
            value={props.categoryFilter}
            onChange={(event) => props.setCategoryFilter(event.target.value)}
          >
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="panel-section panel-card">
        <div className="panel-header">
          <h2>Trips Animation</h2>
          <span className="panel-pill">Timeline</span>
        </div>
        <button
          type="button"
          className="panel-button"
          onClick={() => props.setIsPlaying(!props.isPlaying)}
        >
          {props.isPlaying ? 'Pause' : 'Play'}
        </button>
        <label className="field">
          <span>Time</span>
          <input
            type="range"
            min={props.minTime}
            max={props.maxTime}
            value={props.currentTime}
            onChange={(event) => props.setCurrentTime(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="panel-footer">Click any layer to focus the camera.</div>
    </aside>
  );
}
