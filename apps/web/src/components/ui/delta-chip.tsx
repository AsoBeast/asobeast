import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type DeltaPolarity = "higher-is-better" | "lower-is-better";

type Direction = "up" | "down" | "flat";

const GLYPH: Record<Direction, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
};

const TONE: Record<Direction, string> = {
  up: "text-signal-up",
  down: "text-signal-down",
  flat: "text-muted-foreground",
};

function direction(value: number, polarity: DeltaPolarity): Direction {
  if (value === 0) return "flat";
  const improved = polarity === "lower-is-better" ? value < 0 : value > 0;
  return improved ? "up" : "down";
}

export function DeltaChip({
  value,
  polarity = "lower-is-better",
  period,
  unit = "",
  className,
}: {
  value: number | null;
  polarity?: DeltaPolarity;
  period: string;
  unit?: string;
  className?: string;
}) {
  if (value === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (value === 0) {
    return <span className="numeric font-mono text-muted-foreground">0</span>;
  }

  const way = direction(value, polarity);
  const Icon = GLYPH[way];
  const magnitude = Math.abs(value);

  return (
    <span
      aria-label={`${way} ${magnitude} ${period}`}
      className={cn(
        "numeric font-mono inline-flex items-center gap-0.5 font-medium",
        TONE[way],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span>{`${magnitude}${unit}`}</span>
    </span>
  );
}

export function PositionDeltaChip({
  value,
  period = "since yesterday",
}: {
  value: number | null;
  period?: string;
}) {
  if (value === null || value === 0) return null;

  const way = direction(value, "lower-is-better");
  const Icon = GLYPH[way];
  const magnitude = Math.abs(value);

  return (
    <span
      aria-label={`${way} ${magnitude} ${period}`}
      className={cn(
        "numeric font-mono inline-flex items-center gap-0.5 text-xs font-medium",
        TONE[way],
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span>{magnitude}</span>
    </span>
  );
}

export function TrendChip({
  label,
  value,
  unit = "",
}: {
  label: string;
  value: number | null;
  unit?: string;
}) {
  if (value === null) {
    return (
      <span className="text-xs text-muted-foreground">no {label} data</span>
    );
  }

  const rounded = Math.round(value);
  const way = direction(rounded, "higher-is-better");
  const Icon = GLYPH[way];
  const signed = rounded > 0 ? `+${rounded}` : String(rounded);

  return (
    <span
      className={cn(
        "numeric font-mono inline-flex items-center gap-0.5 text-xs font-medium",
        TONE[way],
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span>{`${signed}${unit} ${label}`}</span>
    </span>
  );
}
