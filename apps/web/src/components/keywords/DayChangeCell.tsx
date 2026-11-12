import { DeltaChip } from "@/components/ui/delta-chip";
import type { DayChange } from "@/lib/keyword-day-change";
import { cn } from "@/lib/utils";

const WORD =
  "inline-flex h-[22px] items-center rounded-md px-[7px] text-label font-medium";

const WORDS: Record<
  "lost" | "entered",
  { label: string; name: string; tone: string }
> = {
  lost: {
    label: "Lost",
    name: "Dropped out of the results since yesterday",
    tone: "bg-signal-down-subtle text-signal-down",
  },
  entered: {
    label: "New",
    name: "Entered the results since yesterday",
    tone: "bg-signal-up-subtle text-signal-up",
  },
};

const MUTED = "bg-transparent px-0 text-muted-foreground";

export function DayChangeCell({
  change,
  muted,
}: {
  change: DayChange | null;
  muted: boolean;
}) {
  if (change === null) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden>—</span>
        <span className="sr-only">No change since yesterday to show</span>
      </span>
    );
  }
  if (change.kind === "lost" || change.kind === "entered") {
    const word = WORDS[change.kind];
    return (
      <span
        data-change={change.kind}
        className={cn(WORD, muted ? MUTED : word.tone)}
      >
        <span aria-hidden>{word.label}</span>
        <span className="sr-only">{word.name}</span>
      </span>
    );
  }
  const places = change.kind === "moved" ? change.places : 0;
  return (
    <DeltaChip
      value={places}
      period="since yesterday"
      form={places === 0 ? "text" : "pill"}
      className={muted ? MUTED : undefined}
    />
  );
}
