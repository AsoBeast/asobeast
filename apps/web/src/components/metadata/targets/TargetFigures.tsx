import type { TargetScores } from "@asobeast/shared";
import { GradedNumber } from "@/components/ui/graded";
import { grade } from "@/lib/grade";

const positionText = (scores: TargetScores): string | null => {
  if (scores.position !== null) return `#${scores.position}`;
  return scores.depth === null ? null : `>${scores.depth}`;
};

export function TargetFigures({ scores }: { scores: TargetScores }) {
  const position = positionText(scores);
  return (
    <span className="inline-flex shrink-0 items-center gap-3 text-caption text-muted-foreground">
      {scores.popularity === null ? null : (
        <GradedNumber
          value={String(Math.round(scores.popularity))}
          grade={grade("popularity", scores.popularity)}
          label="Popularity"
        />
      )}
      {position === null ? null : (
        <GradedNumber
          value={position}
          grade={grade("position", scores.position)}
          label="Position"
        />
      )}
    </span>
  );
}
