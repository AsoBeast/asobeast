import type {
  KeywordInspection,
  KeywordInspectionDelta,
} from "@asobeast/shared";
import { formatDateTime, formatList } from "@/lib/format";
import { cn } from "@/lib/utils";
import { scoreChange, signedChange } from "./inspection-format";

function ScoreChange({
  label,
  change,
  higherIsBetter,
}: {
  label: string;
  change: number | null;
  higherIsBetter: boolean;
}) {
  const better =
    change === null || change === 0 ? null : change > 0 === higherIsBetter;
  return (
    <span className="inline-flex items-baseline gap-1">
      {label}
      <span
        className={cn(
          "numeric font-mono font-medium",
          better === null && "text-muted-foreground",
          better === true && "text-signal-up",
          better === false && "text-signal-down",
        )}
      >
        {signedChange(change)}
      </span>
      {better === null ? null : (
        <span className="sr-only">{better ? "(better)" : "(worse)"}</span>
      )}
    </span>
  );
}

export function InspectionDelta({
  inspection,
  previous,
}: {
  inspection: KeywordInspection;
  previous: KeywordInspectionDelta;
}) {
  return (
    <section
      aria-labelledby="inspection-delta"
      className="flex flex-col gap-1 text-sm"
    >
      <h3 id="inspection-delta" className="sr-only">
        Since the previous inspection
      </h3>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-muted-foreground">
          Since {formatDateTime(previous.completedAt)}
        </span>
        <ScoreChange
          label="Popularity"
          change={scoreChange(inspection.volume, previous.volume)}
          higherIsBetter
        />
        <ScoreChange
          label="Difficulty"
          change={scoreChange(inspection.difficulty100, previous.difficulty100)}
          higherIsBetter={false}
        />
      </p>
      {previous.left.length > 0 ? (
        <p className="text-muted-foreground">
          Left the top 10: {formatList(previous.left)}
        </p>
      ) : null}
    </section>
  );
}
