import type {
  KeywordInspection,
  KeywordInspectionDelta,
  KeywordInspectionSummary,
} from "@asobeast/shared";
import { useZoneThresholds } from "@/components/keywords/use-zone-thresholds";
import { formatDateTime, formatList } from "@/lib/format";
import { ZONE_LABELS, zoneMeaning, zoneOf } from "@/lib/keyword-zones";
import {
  autocompleteLine,
  changeTone,
  scoreChange,
  signedChange,
  storefrontCode,
} from "./inspection-format";

const NOTE = "text-caption text-faint-foreground";
const ELSEWHERE_LINK =
  "rounded-sm text-foreground link-underline outline-none focus-visible:ring-2 focus-visible:ring-ring";

function spokenChange(
  label: string,
  change: number | null,
  higherIsBetter: boolean,
): string {
  const tone = changeTone(change, higherIsBetter);
  return `${label} ${signedChange(change)}${tone === "same" ? "" : ` (${tone})`}`;
}

function InspectionVerdict({ inspection }: { inspection: KeywordInspection }) {
  const { thresholds } = useZoneThresholds();
  if (inspection.volume === null || inspection.difficulty100 === null) {
    return null;
  }
  const zone = zoneOf(
    {
      popularity: Math.round(inspection.volume),
      difficulty: Math.round(inspection.difficulty100),
    },
    thresholds,
  );
  if (zone === null) return null;
  return (
    <p className="text-body text-muted-foreground">
      <span className="font-medium text-foreground">{ZONE_LABELS[zone]}</span>
      <span>{` on your thresholds. ${zoneMeaning(zone)}`}</span>
    </p>
  );
}

function InspectionDelta({
  inspection,
  previous,
}: {
  inspection: KeywordInspection;
  previous: KeywordInspectionDelta;
}) {
  const moves = [
    previous.entered.length > 0
      ? `${formatList(previous.entered.map((app) => app.title))} entered the top 10`
      : null,
    previous.left.length > 0
      ? `${formatList(previous.left.map((app) => app.title))} left the top 10`
      : null,
  ].filter((move) => move !== null);
  return (
    <section aria-labelledby="inspection-delta" className={NOTE}>
      <h3 id="inspection-delta" className="sr-only">
        Since the previous inspection
      </h3>
      <p>
        <span>{`Compared with ${formatDateTime(previous.completedAt)}`}</span>
        {moves.map((move) => (
          <span key={move}>{` · ${move}`}</span>
        ))}
      </p>
      <p className="sr-only">
        {[
          spokenChange(
            "Popularity",
            scoreChange(inspection.volume, previous.volume),
            true,
          ),
          spokenChange(
            "Difficulty",
            scoreChange(inspection.difficulty100, previous.difficulty100),
            false,
          ),
        ].join(", ")}
      </p>
    </section>
  );
}

function SearchNotes({
  inspection,
  elsewhere,
  onSelect,
}: {
  inspection: KeywordInspection;
  elsewhere: readonly KeywordInspectionSummary[];
  onSelect: (id: string) => void;
}) {
  const autocomplete = autocompleteLine(inspection.signals);
  if (autocomplete === null && elsewhere.length === 0) return null;
  return (
    <p className={NOTE}>
      {autocomplete === null ? null : <span>{autocomplete}</span>}
      {autocomplete !== null && elsewhere.length > 0 ? <span> · </span> : null}
      {elsewhere.length > 0 ? <span>Also inspected in </span> : null}
      {elsewhere.map((item, index) => (
        <span key={item.id}>
          {index > 0 ? <span>, </span> : null}
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            className={ELSEWHERE_LINK}
          >
            {storefrontCode(item.store, item.country)}
          </button>
        </span>
      ))}
    </p>
  );
}

export function InspectionNotes({
  inspection,
  elsewhere,
  onSelect,
}: {
  inspection: KeywordInspection;
  elsewhere: readonly KeywordInspectionSummary[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <InspectionVerdict inspection={inspection} />
      {inspection.previous ? (
        <InspectionDelta
          inspection={inspection}
          previous={inspection.previous}
        />
      ) : null}
      <SearchNotes
        inspection={inspection}
        elsewhere={elsewhere}
        onSelect={onSelect}
      />
    </div>
  );
}
