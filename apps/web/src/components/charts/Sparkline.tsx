import type { VisibilityPoint } from "@asobeast/shared";
import { cn } from "@/lib/utils";
import { seriesColor } from "./theme";
import { areaPath, monotonePath, sparklinePoints } from "./sparkline-path";

const BOX = { width: 120, height: 48, padding: 3 };

const TREND_BOX = { width: 72, height: 22, padding: 2 };

type Direction = "up" | "down" | "flat";

function trendDirection(first: number, last: number): Direction {
  if (last > first) return "up";
  if (last < first) return "down";
  return "flat";
}

export function TrendLine({
  values,
  label,
  now,
  className,
}: {
  values: number[];
  label: string;
  now: string;
  className?: string;
}) {
  if (values.length < 2) {
    return (
      <span
        className={cn(
          "text-caption whitespace-nowrap text-faint-foreground",
          className,
        )}
      >
        Not enough history
      </span>
    );
  }
  const direction = trendDirection(values[0], values[values.length - 1]);
  return (
    <svg
      role="img"
      aria-label={`${label}: ${direction}, now ${now}`}
      width={TREND_BOX.width}
      height={TREND_BOX.height}
      viewBox={`0 0 ${TREND_BOX.width} ${TREND_BOX.height}`}
      className={cn("block shrink-0", className)}
    >
      <path
        d={monotonePath(sparklinePoints(values, TREND_BOX))}
        fill="none"
        stroke={seriesColor(0)}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Sparkline({ points }: { points: VisibilityPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-12 items-center text-caption text-muted-foreground">
        Not enough history yet
      </div>
    );
  }

  const values = points.map((point) => point.visibility);
  const first = values[0];
  const last = values[values.length - 1];
  const direction = trendDirection(first, last);
  const plotted = sparklinePoints(values, BOX);
  const [endX, endY] = plotted[plotted.length - 1];

  return (
    <div
      className={cn(
        "relative h-12 w-full",
        direction === "up" && "text-signal-up",
        direction === "down" && "text-signal-down",
        direction === "flat" && "text-muted-foreground",
      )}
    >
      <svg
        role="img"
        aria-label={`visibility, last 30 days: ${direction}, now ${Math.round(last)}`}
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
      >
        <path
          d={areaPath(plotted, BOX.height - BOX.padding)}
          fill="currentColor"
          fillOpacity={0.12}
          stroke="none"
        />
        <path
          d={monotonePath(plotted)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        aria-hidden
        data-slot="sparkline-end"
        className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current"
        style={{
          left: `${(endX / BOX.width) * 100}%`,
          top: `${(endY / BOX.height) * 100}%`,
        }}
      />
    </div>
  );
}
