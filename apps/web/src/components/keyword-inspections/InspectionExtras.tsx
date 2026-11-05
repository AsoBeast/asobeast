import type {
  KeywordInspection,
  KeywordInspectionDelta,
} from "@asobeast/shared";
import { formatDateTime, formatList } from "@/lib/format";
import { scoreChange, signedChange } from "./inspection-format";

export function InspectionSuggestions({
  inspection,
}: {
  inspection: KeywordInspection;
}) {
  return (
    <section
      aria-labelledby="inspection-suggestions"
      className="flex flex-col gap-2"
    >
      <h3 id="inspection-suggestions" className="text-body font-semibold">
        Store autocomplete
      </h3>
      {inspection.suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The store suggested nothing for this keyword.
        </p>
      ) : (
        <ol className="flex flex-wrap gap-2">
          {inspection.suggestions.map((suggestion) => (
            <li
              key={suggestion.term}
              className="rounded-full border px-3 py-1 text-sm"
            >
              <span className="mr-1 text-muted-foreground">
                {suggestion.position}.
              </span>
              {suggestion.term}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MoverLine({ label, titles }: { label: string; titles: string[] }) {
  return (
    <p className="text-sm">
      <span className="font-medium">{label}: </span>
      {titles.length === 0 ? (
        <span className="text-muted-foreground">none</span>
      ) : (
        formatList(titles)
      )}
    </p>
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
    <section aria-labelledby="inspection-delta" className="flex flex-col gap-2">
      <h3 id="inspection-delta" className="text-body font-semibold">
        Since the previous inspection
      </h3>
      <p className="text-sm text-muted-foreground">
        Compared with the run of {formatDateTime(previous.completedAt)}.
      </p>
      <p className="flex flex-wrap items-center gap-4 text-sm">
        <span>
          Popularity{" "}
          <span className="numeric font-mono font-medium">
            {signedChange(scoreChange(inspection.volume, previous.volume))}
          </span>
        </span>
        <span>
          Difficulty{" "}
          <span className="numeric font-mono font-medium">
            {signedChange(
              scoreChange(inspection.difficulty100, previous.difficulty100),
            )}
          </span>
        </span>
      </p>
      <MoverLine label="Entered the top 10" titles={previous.entered} />
      <MoverLine label="Left the top 10" titles={previous.left} />
    </section>
  );
}
