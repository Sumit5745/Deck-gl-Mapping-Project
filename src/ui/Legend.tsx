import { getChoroplethColor } from '../layers';

export type LegendProps = {
  min: number;
  max: number;
  steps?: number;
};

export function Legend({ min, max, steps = 5 }: LegendProps) {
  const values = Array.from({ length: steps }, (_, index) => {
    if (steps === 1) {
      return min;
    }
    return min + ((max - min) * index) / (steps - 1);
  });

  return (
    <div className="legend">
      <div className="legend-title">Choropleth Scale</div>
      <div className="legend-scale">
        {values.map((value) => {
          const color = getChoroplethColor(value, min, max);
          const style = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;

          return (
            <div key={value} className="legend-item">
              <span className="legend-swatch" style={{ backgroundColor: style }} />
              <span className="legend-label">{Math.round(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
