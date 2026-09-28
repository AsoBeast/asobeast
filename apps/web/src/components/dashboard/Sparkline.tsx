import type { VisibilityPoint } from "@asobeast/shared";
import { cn } from "@/lib/utils";
import { areaPath, monotonePath, sparklinePoints } from "./sparkline-path";

const BOX = { width: 120, height: 48, padding: 3 };

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
  const direction = last > first ? "up" : last < first ? "down" : "flat";
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
        aria-label={`visibility, last 30 days: ${direction}, now ${last}`}
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
