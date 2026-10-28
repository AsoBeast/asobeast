import type { TrackedKeywordItem } from "@asobeast/shared";
import { PositionDeltaChip } from "@/components/ui/delta-chip";
import { GradedNumber } from "@/components/ui/graded";
import { grade } from "@/lib/grade";
import { cn } from "@/lib/utils";

export function PositionReadout({
  keyword,
  label,
  staleOn,
  className,
}: {
  keyword: TrackedKeywordItem;
  label: string;
  staleOn: string | null;
  className?: string;
}) {
  return (
    <span className="numeric font-mono inline-flex shrink-0 items-center gap-1.5">
      {keyword.latestPosition === null ? (
        <span className={cn("text-muted-foreground", className)}>{label}</span>
      ) : (
        <GradedNumber
          value={label}
          grade={grade("position", keyword.latestPosition)}
          label="Position"
          className={className}
        />
      )}
      <PositionDeltaChip
        value={staleOn === null ? keyword.positionDelta1d : null}
      />
    </span>
  );
}
