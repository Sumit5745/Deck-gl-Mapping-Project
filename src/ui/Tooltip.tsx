export type TooltipInfo = {
  x: number;
  y: number;
  object: Record<string, any> | null;
  layerId: string | null;
};

export type TooltipProps = {
  info: TooltipInfo | null;
};

export function Tooltip({ info }: TooltipProps) {
  if (!info || !info.object || !info.layerId) {
    return null;
  }

  const style = {
    left: info.x,
    top: info.y
  } as const;

  let content: string[] = [];

  if (info.layerId === 'points') {
    if (info.object.properties?.cluster) {
      content = [`Cluster`, `Points: ${info.object.properties.point_count}`];
    } else {
      content = [
        `Point ${info.object.id ?? info.object.properties?.id ?? ''}`,
        `Category: ${info.object.category ?? info.object.properties?.category ?? ''}`,
        `Rating: ${info.object.rating ?? info.object.properties?.rating ?? ''}`
      ];
    }
  }

  if (info.layerId === 'polygons') {
    content = [
      `Region: ${info.object.properties?.region ?? ''}`,
      `Value: ${info.object.properties?.value ?? ''}`
    ];
  }

  if (info.layerId === 'routes') {
    content = [
      `From: ${info.object.properties?.from ?? ''}`,
      `To: ${info.object.properties?.to ?? ''}`,
      `Volume: ${info.object.properties?.volume ?? ''}`
    ];
  }

  if (info.layerId === 'trips') {
    content = [`Vehicle: ${info.object.vendor ?? ''}`];
  }

  if (info.layerId === 'hexagon') {
    const points = info.object.points ?? [];
    content = [`Hexagon`, `Points: ${points.length}`];
  }

  if (content.length === 0) {
    return null;
  }

  return (
    <div className="tooltip" style={style}>
      {content.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}
