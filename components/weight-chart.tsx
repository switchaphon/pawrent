"use client";

import type { PetWeightLog } from "@/lib/types/health";

interface WeightChartProps {
  data: PetWeightLog[];
  width?: number;
  height?: number;
}

/**
 * SVG-based weight trend chart. No external chart library.
 * Renders a simple line chart with dots and labels for the last N entries.
 */
export function WeightChart({ data, width = 340, height = 200 }: WeightChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-8 text-sm text-text-muted">
        ยังไม่มีข้อมูลน้ำหนัก
      </div>
    );
  }

  // Sort ascending by date for chart
  const sorted = [...data].sort(
    (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()
  );

  const weights = sorted.map((d) => d.weight_kg);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  const padding = { top: 20, right: 16, bottom: 32, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = sorted.map((d, i) => ({
    x: padding.left + (sorted.length === 1 ? chartW / 2 : (i / (sorted.length - 1)) * chartW),
    y: padding.top + chartH - ((d.weight_kg - minW) / range) * chartH,
    weight: d.weight_kg,
    date: d.measured_at,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Y-axis labels (3 ticks)
  const yTicks = [minW, minW + range / 2, maxW];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Weight trend chart"
    >
      {/* Grid lines */}
      {yTicks.map((tick) => {
        const y = padding.top + chartH - ((tick - minW) / range) * chartH;
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#E5E7EB"
              strokeDasharray="4"
            />
            <text
              x={padding.left - 6}
              y={y + 4}
              textAnchor="end"
              className="fill-gray-400"
              fontSize="10"
            >
              {tick.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Line */}
      {points.length > 1 && (
        <polyline
          points={polyline}
          fill="none"
          stroke="#6366F1"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#6366F1" />
      ))}

      {/* X-axis date labels (first and last) */}
      {sorted.length > 0 && (
        <>
          <text
            x={points[0].x}
            y={height - 6}
            textAnchor="start"
            className="fill-gray-400"
            fontSize="10"
          >
            {formatDate(sorted[0].measured_at)}
          </text>
          {sorted.length > 1 && (
            <text
              x={points[points.length - 1].x}
              y={height - 6}
              textAnchor="end"
              className="fill-gray-400"
              fontSize="10"
            >
              {formatDate(sorted[sorted.length - 1].measured_at)}
            </text>
          )}
        </>
      )}
    </svg>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
