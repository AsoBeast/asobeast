import type { ReactNode } from "react";
import { seriesDash } from "./theme";

export interface SeriesTooltipItem {
  key: string;
  index: number;
  color?: string;
  label: ReactNode;
  value: string;
  sortBy: number;
}

export function SeriesTooltip({
  title,
  items,
}: {
  title: string;
  items: SeriesTooltipItem[];
}) {
  const ordered = [...items].sort((a, b) => a.sortBy - b.sortBy);

  return (
    <div
      role="tooltip"
      className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-overlay"
    >
      <div className="font-medium">{title}</div>
      <div className="grid gap-1.5">
        {ordered.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <svg aria-hidden width="14" height="8" viewBox="0 0 14 8">
                <line
                  x1="0"
                  y1="4"
                  x2="14"
                  y2="4"
                  stroke={item.color}
                  strokeWidth="2"
                  strokeDasharray={seriesDash(item.index)}
                />
              </svg>
              {item.label}
            </span>
            <span className="numeric font-mono font-medium text-foreground">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
