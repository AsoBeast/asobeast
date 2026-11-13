import type { ChartEntryItem } from "@asobeast/shared";
import { DirectionArrow } from "@/components/ui/delta-chip";
import { cn } from "@/lib/utils";
import {
  movementCounts,
  movementText,
  movementTotal,
  type MovementCounts,
} from "./chart-summary";

const SEGMENTS: ReadonlyArray<{
  id: keyof MovementCounts;
  word: string;
  bar: string;
  way?: "up" | "down";
}> = [
  { id: "climbed", word: "climbed", bar: "bg-signal-up", way: "up" },
  {
    id: "entered",
    word: "new",
    bar: "bg-[color-mix(in_srgb,var(--signal-up)_45%,var(--card))]",
  },
  { id: "held", word: "held", bar: "bg-border" },
  { id: "fell", word: "fell", bar: "bg-signal-down", way: "down" },
];

const TONE = { up: "text-signal-up", down: "text-signal-down" } as const;

export function MovementBar({
  entries,
  period,
}: {
  entries: readonly ChartEntryItem[];
  period: string;
}) {
  const counts = movementCounts(entries);
  if (movementTotal(counts) === 0) return null;
  const shown = SEGMENTS.filter(({ id }) => counts[id] > 0);

  return (
    <div
      role="img"
      aria-label={`${movementText(counts)} ${period}`}
      className="flex flex-col gap-2 px-4"
    >
      <div className="flex h-1.5 gap-0.5">
        {shown.map(({ id, bar }) => (
          <span
            key={id}
            className={cn("min-w-1 rounded-xs", bar)}
            style={{ flexGrow: counts[id] }}
          />
        ))}
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-caption text-muted-foreground">
        {shown.map(({ id, word, way }) => (
          <span key={id} className="inline-flex items-center gap-1">
            {way ? (
              <DirectionArrow way={way} className={cn("size-3", TONE[way])} />
            ) : null}
            <span className="numeric font-medium text-foreground">
              {counts[id]}
            </span>
            <span>{word}</span>
          </span>
        ))}
      </p>
    </div>
  );
}
