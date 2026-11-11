import type {
  KeywordInspection,
  KeywordInspectionDelta,
} from "@asobeast/shared";
import { formatDateTime, formatList } from "@/lib/format";
import { cn } from "@/lib/utils";
import { changeTone, scoreChange, signedChange } from "./inspection-format";

function ScoreChange({
  label,
  change,
  higherIsBetter,
}: {
  label: string;
  change: number | null;
  higherIsBetter: boolean;
}) {
  const tone = changeTone(change, higherIsBetter);
  return (
    <span className="inline-flex items-baseline gap-1">
      {label}
      <span
        className={cn(
          "numeric font-medium",
          tone === "same" && "text-muted-foreground",
          tone === "better" && "text-signal-up",
          tone === "worse" && "text-signal-down",
        )}
      >
        {signedChange(change)}
      </span>
      {tone === "same" ? null : <span className="sr-only">{`(${tone})`}</span>}
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
          {`Since ${formatDateTime(previous.completedAt)}`}
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
          {`Left the top 10: ${formatList(previous.left.map((app) => app.title))}`}
        </p>
      ) : null}
    </section>
  );
}
