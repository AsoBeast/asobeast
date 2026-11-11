import type { TrackedKeywordItem } from "@asobeast/shared";
import { PositionDeltaChip } from "@/components/ui/delta-chip";
import { GradedNumber } from "@/components/ui/graded";
import { formatDate } from "@/lib/format";
import { grade, type Grade } from "@/lib/grade";
import type { LostPosition } from "@/lib/keyword-checks";
import { cn } from "@/lib/utils";

export const lastRankedLine = (position: number, on: string) =>
  `Last ranked #${position} on ${formatDate(on)}`;

const CHIP = "h-6 min-w-9 justify-center rounded-md px-1.5 font-semibold";

const CHIP_TIER: Partial<Record<Grade, string>> = {
  strong: "bg-signal-up-subtle text-signal-up",
  fair: "bg-secondary shadow-[inset_0_0_0_1px_var(--border)]",
};

export function PositionReadout({
  keyword,
  label,
  staleOn,
  lost = null,
  chip = false,
  className,
}: {
  keyword: TrackedKeywordItem;
  label: string;
  staleOn: string | null;
  lost?: LostPosition | null;
  chip?: boolean;
  className?: string;
}) {
  const tier = grade("position", keyword.latestPosition);
  return (
    <span className="numeric inline-flex shrink-0 items-center gap-1.5">
      {keyword.latestPosition === null ? (
        <span
          title={lost?.on ? lastRankedLine(lost.position, lost.on) : undefined}
          className={cn("text-muted-foreground", className)}
        >
          {lost ? `${label} (was #${lost.position})` : label}
        </span>
      ) : (
        <GradedNumber
          value={label}
          grade={tier}
          label="Position"
          marker={!chip}
          className={cn(
            chip && CHIP,
            chip && tier && CHIP_TIER[tier],
            className,
          )}
        />
      )}
      <span className={chip ? "inline-flex w-8 justify-start" : "contents"}>
        <PositionDeltaChip
          value={staleOn === null ? keyword.positionDelta1d : null}
        />
      </span>
    </span>
  );
}
