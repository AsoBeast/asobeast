import type { VisibilityPoint } from "@asobeast/shared";
import { cn } from "@/lib/utils";

const WIDTH = 120;
const HEIGHT = 40;
const PADDING = 3;

interface Shape {
  path: string;
  endX: number;
  endY: number;
}

function shapeFrom(values: number[]): Shape {
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const step = (WIDTH - PADDING * 2) / (values.length - 1);
  const points = values.map((value, index) => {
    const x = PADDING + index * step;
    const y =
      HEIGHT - PADDING - ((value - min) / span) * (HEIGHT - PADDING * 2);
    return [x, y] as const;
  });

  return {
    path: points
      .map(
        ([x, y], index) =>
          `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`,
      )
      .join(" "),
    endX: points[points.length - 1][0],
    endY: points[points.length - 1][1],
  };
}

export function Sparkline({ points }: { points: VisibilityPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-10 items-center text-caption text-muted-foreground">
        Not enough history yet
      </div>
    );
  }

  const values = points.map((point) => point.visibility);
  const first = values[0];
  const last = values[values.length - 1];
  const direction = last > first ? "up" : last < first ? "down" : "flat";
  const shape = shapeFrom(values);

  return (
    <div
      className={cn(
        "relative h-10 w-full",
        direction === "up" && "text-signal-up",
        direction === "down" && "text-signal-down",
        direction === "flat" && "text-muted-foreground",
      )}
    >
      <svg
        role="img"
        aria-label={`visibility, last 30 days: ${direction}, now ${last}`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-full w-full"
      >
        <path
          d={shape.path}
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
          left: `${(shape.endX / WIDTH) * 100}%`,
          top: `${(shape.endY / HEIGHT) * 100}%`,
        }}
      />
    </div>
  );
}
