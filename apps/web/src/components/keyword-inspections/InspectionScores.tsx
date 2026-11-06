import type { KeywordInspection } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import { Meter, type MeterTone } from "@/components/ui/meter";
import {
  SCORING_CONFIDENCE_LABELS,
  SCORING_SOURCE_LABELS,
} from "@/components/keywords/score-cells";
import {
  difficultySignalLines,
  popularitySignalLines,
} from "@/components/keywords/score-signals";
import { competitionFacts, shownScore } from "./inspection-format";

const OPPORTUNITY_NOTE =
  "Opportunity weighs popularity against difficulty, before any app is considered.";

function ScoreTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: MeterTone;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 first:pl-0 last:pr-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="numeric font-mono text-2xl leading-none font-medium">
        {shownScore(value)}
      </dd>
      <Meter value={value ?? 0} tone={tone} />
    </div>
  );
}

export function InspectionScores({
  inspection,
}: {
  inspection: KeywordInspection;
}) {
  const { provenance, signals } = inspection;
  const explanation = [
    ...popularitySignalLines(signals, provenance?.source, inspection.volume),
    ...difficultySignalLines(signals),
    OPPORTUNITY_NOTE,
  ].join(" ");
  return (
    <section aria-label="Scores" className="flex flex-col gap-2">
      <dl className="grid grid-cols-3 divide-x border-y py-3">
        <ScoreTile label="Popularity" value={inspection.volume} tone="score" />
        <ScoreTile
          label="Difficulty"
          value={inspection.difficulty100}
          tone="neutral"
        />
        <ScoreTile
          label="Opportunity"
          value={inspection.opportunity}
          tone="opportunity"
        />
      </dl>
      {provenance ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{SCORING_SOURCE_LABELS[provenance.source]}</span>
          <span aria-hidden>·</span>
          <span>Formula {provenance.formulaVersion}</span>
          <Badge variant="secondary">
            {SCORING_CONFIDENCE_LABELS[provenance.confidence]} confidence
          </Badge>
          <InfoTip
            label="How these scores are estimated"
            title="How these scores are estimated"
            summary={explanation}
          />
        </p>
      ) : null}
    </section>
  );
}

export function InspectionCompetition({
  inspection,
}: {
  inspection: KeywordInspection;
}) {
  if (!inspection.competition) return null;
  return (
    <section
      aria-labelledby="inspection-competition"
      className="flex flex-col gap-2"
    >
      <h3 id="inspection-competition" className="text-sm font-medium">
        Competition in the top {inspection.competition.topCount}
      </h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {competitionFacts(inspection.competition).map((fact) => (
          <div key={fact.label} className="flex min-w-0 flex-col">
            <dt className="text-xs text-muted-foreground">{fact.label}</dt>
            <dd className="numeric font-mono text-base font-medium">
              {fact.value}
            </dd>
            <dd className="text-xs text-muted-foreground">{fact.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
