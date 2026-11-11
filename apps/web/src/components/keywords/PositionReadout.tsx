import type { TrackedKeywordItem } from "@asobeast/shared";
import { PositionDeltaChip } from "@/components/ui/delta-chip";
import { GradedNumber } from "@/components/ui/graded";
import { formatDate } from "@/lib/format";
import { grade } from "@/lib/grade";
import type { LostPosition } from "@/lib/keyword-checks";
import { cn } from "@/lib/utils";

export const lastRankedLine = (position: number, on: string) =>
  `Last ranked #${position} on ${formatDate(on)}`;

export function PositionReadout({
  keyword,
  label,
  staleOn,
  lost = null,
  aligned = false,
  className,
}: {
  keyword: TrackedKeywordItem;
  label: string;
  staleOn: string | null;
  lost?: LostPosition | null;
  aligned?: boolean;
  className?: string;
}) {
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
          grade={grade("position", keyword.latestPosition)}
          label="Position"
          aligned={aligned}
          className={className}
        />
      )}
      <span className={aligned ? "inline-flex w-8 justify-start" : "contents"}>
        <PositionDeltaChip
          value={staleOn === null ? keyword.positionDelta1d : null}
        />
      </span>
    </span>
  );
}
