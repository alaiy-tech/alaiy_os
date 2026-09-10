"use client";

import { useRef, useState } from "react";
import { formatDate } from "@/lib/format";
import type { HandlingTimePoint } from "@/lib/shipping/types";

/**
 * Daily average handling time — one series, so no legend (the heading already
 * says what is plotted): a 2px accent line, a ~10% wash under it, an end
 * marker with a surface ring, and a direct label on the last value.
 *
 * The crosshair is the point of the chart, not a flourish — a spike is easy
 * to *see*, but which day it happened on is the thing the seller actually
 * needs, and that only comes from hovering.
 *
 * **A day with no dispatch is absent from the series, not zero.** The backend
 * omits it, so the line joins the days either side rather than diving to the
 * floor on the quietest day of the week and drawing a spike toward perfect
 * handling.
 *
 * There are no business-event markers. The chart used to carry a dashed
 * "switched 3PL" annotation; logging a business event needs somewhere to log
 * it, and there is nothing to sync one from.
 */

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 200;
const PAD = { top: 20, right: 16, bottom: 28, left: 34 };

export function HandlingTimeChart({ points }: { points: HandlingTimePoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotWidth = VIEW_WIDTH - PAD.left - PAD.right;
  const plotHeight = VIEW_HEIGHT - PAD.top - PAD.bottom;

  // Real data can be one point, or none: a workspace that connected yesterday
  // has a single day of dispatches. Math.max() of nothing is -Infinity and
  // dividing by (length - 1) is NaN, either of which renders an empty box with
  // no explanation.
  const maxValue = points.length ? Math.max(...points.map((p) => p.avg_hours)) : 0;
  const maxY = Math.max(30, Math.ceil(maxValue / 10) * 10);

  const span = Math.max(points.length - 1, 1);
  const x = (index: number) =>
    // A lone point sits at the left edge rather than at 0/0.
    points.length === 1 ? PAD.left : PAD.left + (index / span) * plotWidth;
  const y = (value: number) => PAD.top + (1 - value / maxY) * plotHeight;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.avg_hours)}`).join(" ");
  const areaPath = `${linePath} L${x(points.length - 1)},${PAD.top + plotHeight} L${x(0)},${PAD.top + plotHeight} Z`;

  const ticks = [0, maxY / 2, maxY];
  const last = points[points.length - 1];

  function indexFromClientX(clientX: number): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const relX = ((clientX - rect.left) / rect.width) * VIEW_WIDTH;
    const ratio = (relX - PAD.left) / plotWidth;
    return Math.min(points.length - 1, Math.max(0, Math.round(ratio * span)));
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="space-y-2">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label={`Average handling time, ${formatDate(points[0]?.date)} to ${formatDate(last?.date)}: ${points.map((p) => p.avg_hours).join(", ")} hours`}
          onPointerMove={(event) => setHoverIndex(indexFromClientX(event.clientX))}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={VIEW_WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-soft text-[9px]"
              >
                {tick}h
              </text>
            </g>
          ))}

          <path d={areaPath} className="fill-highlight-600/10" stroke="none" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-highlight-600)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {last ? (
            <>
              <circle
                cx={x(points.length - 1)}
                cy={y(last.avg_hours)}
                r={4}
                fill="var(--color-highlight-600)"
                stroke="var(--color-canvas)"
                strokeWidth={2}
              />
              <text
                x={x(points.length - 1)}
                y={y(last.avg_hours) - 10}
                textAnchor="end"
                className="fill-primary-600 font-data text-[11px] font-semibold"
              >
                {last.avg_hours}h
              </text>
            </>
          ) : null}

          {hoverIndex !== null ? (
            <line
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={PAD.top}
              y2={PAD.top + plotHeight}
              stroke="var(--color-primary-600)"
              strokeWidth={1}
              strokeOpacity={0.35}
            />
          ) : null}

          <text x={PAD.left} y={VIEW_HEIGHT - 8} className="fill-muted-soft text-[9px]">
            {formatDate(points[0]?.date)}
          </text>
          <text
            x={VIEW_WIDTH - PAD.right}
            y={VIEW_HEIGHT - 8}
            textAnchor="end"
            className="fill-muted-soft text-[9px]"
          >
            {formatDate(last?.date)}
          </text>
        </svg>

        {hovered ? (
          <div
            className="pointer-events-none absolute top-1 rounded-xs border border-line bg-white px-2 py-1 text-[11px] shadow-float"
            style={{
              left: `${(x(hoverIndex!) / VIEW_WIDTH) * 100}%`,
              transform:
                hoverIndex! > points.length - 4 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            <p className="font-data font-semibold text-primary-600">{hovered.avg_hours}h</p>
            <p className="text-muted-soft">{formatDate(hovered.date)}</p>
          </div>
        ) : null}
      </div>

      <details className="text-[12px] text-muted">
        <summary className="cursor-pointer text-muted-soft hover:text-primary-600">
          View as table
        </summary>
        <div className="mt-2 max-h-48 overflow-y-auto rounded-sm border border-line">
          <table className="w-full border-collapse text-left font-data text-[12px]">
            <thead>
              <tr className="bg-surface">
                <th className="px-2.5 py-1.5 font-sans font-semibold text-primary-500">Date</th>
                <th className="px-2.5 py-1.5 text-right font-sans font-semibold text-primary-500">
                  Avg handling time
                </th>
                <th className="px-2.5 py-1.5 text-right font-sans font-semibold text-primary-500">
                  Shipments
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date} className="border-t border-line/60">
                  <td className="px-2.5 py-1.5">{formatDate(point.date)}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{point.avg_hours}h</td>
                  {/* The point's own sample size. A 40-hour average over one
                      dispatch is one slow parcel, not a slow week. */}
                  <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-soft">
                    {point.shipments}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
