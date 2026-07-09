import { useId } from "react";

import type { ChartPoint } from "@/lib/api";

const palette = ["#0f766e", "#b45309", "#2563eb", "#be123c", "#4d7c0f", "#7c3aed"];

export function BarChart({
  data,
  labelKey,
  valueKey,
  ariaLabel = "Bar chart"
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  ariaLabel?: string;
}) {
  const max = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 1);

  if (!data.length) {
    return <div className="empty-state" role="status">No chart data is available.</div>;
  }

  return (
    <div className="bar-chart" role="img" aria-label={ariaLabel}>
      {data.map((item, index) => {
        const value = Number(item[valueKey] || 0);
        return (
          <div className="bar-row" key={`${item[labelKey]}-${index}`}>
            <span>{String(item[labelKey])}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.max(4, (value / max) * 100)}%`,
                  backgroundColor: palette[index % palette.length]
                }}
                aria-hidden="true"
              />
            </div>
            <strong>{new Intl.NumberFormat("en-US").format(value)}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function MultiLineChart({
  series,
  ariaLabel = "Demand trend by SKU"
}: {
  series: { sku: string; points: ChartPoint[] }[];
  ariaLabel?: string;
}) {
  const titleId = useId();
  const width = 720;
  const height = 260;
  const padding = 34;
  const allValues = series.flatMap((item) => item.points.map((point) => point.value));
  const max = Math.max(...allValues, 1);
  const longest = Math.max(...series.map((item) => item.points.length), 1);

  const buildPath = (points: ChartPoint[]) =>
    points
      .map((point, index) => {
        const x = padding + (index / Math.max(longest - 1, 1)) * (width - padding * 2);
        const y = height - padding - (point.value / max) * (height - padding * 2);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  if (!series.length) {
    return <div className="empty-state">No demand history</div>;
  }

  return (
    <div className="line-chart-wrap">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>{ariaLabel}</title>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} />
        {series.map((item, index) => (
          <path
            key={item.sku}
            d={buildPath(item.points)}
            stroke={palette[index % palette.length]}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="chart-legend">
        {series.map((item, index) => (
          <span key={item.sku}>
            <i style={{ backgroundColor: palette[index % palette.length] }} />
            {item.sku}
          </span>
        ))}
      </div>
    </div>
  );
}
