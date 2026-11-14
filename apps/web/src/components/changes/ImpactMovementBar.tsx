import type { ChangeImpactMovement } from "@asobeast/shared";
import { cn } from "@/lib/utils";

const SEGMENTS: ReadonlyArray<{
  id: keyof ChangeImpactMovement;
  word: string;
  bar: string;
}> = [
  { id: "improved", word: "improved", bar: "bg-signal-up" },
  {
    id: "entered",
    word: "started ranking",
    bar: "bg-[color-mix(in_srgb,var(--signal-up)_45%,var(--card))]",
  },
  { id: "unchanged", word: "unchanged", bar: "bg-border" },
  {
    id: "exited",
    word: "stopped ranking",
    bar: "bg-[color-mix(in_srgb,var(--signal-down)_45%,var(--card))]",
  },
  { id: "declined", word: "declined", bar: "bg-signal-down" },
];

export function ImpactMovementBar({
  movement,
}: {
  movement: ChangeImpactMovement;
}) {
  const shown = SEGMENTS.filter(({ id }) => movement[id] > 0);
  if (shown.length === 0) return null;

  return (
    <span
      role="img"
      aria-label={shown
        .map(({ id, word }) => `${movement[id]} ${word}`)
        .join(", ")}
      className="flex h-1.5 w-full max-w-48 gap-0.5"
    >
      {shown.map(({ id, bar }) => (
        <span
          key={id}
          className={cn("min-w-1 rounded-xs", bar)}
          style={{ flexGrow: movement[id] }}
        />
      ))}
    </span>
  );
}
