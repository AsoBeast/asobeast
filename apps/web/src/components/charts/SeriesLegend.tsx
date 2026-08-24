"use client";

import type { DefaultLegendContentProps } from "recharts";
import { seriesDash } from "./theme";

export type SeriesLabels = Record<string, string>;

export function SeriesLegend({
  payload,
  labels,
  order,
}: DefaultLegendContentProps & {
  labels: SeriesLabels;
  order: string[];
}) {
  if (!payload?.length) return null;

  return (
    <ul
      aria-label="Charted series"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3"
    >
      {payload
        .filter((item) => item.type !== "none")
        .map((item) => {
          const key = String(item.dataKey ?? "");
          return (
            <li key={key} className="flex items-center gap-1.5">
              <svg
                aria-hidden
                width="18"
                height="8"
                viewBox="0 0 18 8"
                className="shrink-0"
              >
                <line
                  x1="0"
                  y1="4"
                  x2="18"
                  y2="4"
                  stroke={item.color}
                  strokeWidth="2"
                  strokeDasharray={seriesDash(order.indexOf(key))}
                />
              </svg>
              {labels[key] ?? key}
            </li>
          );
        })}
    </ul>
  );
}
