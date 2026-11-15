import type {
  KeywordInspection,
  KeywordInspectionDelta,
} from "@asobeast/shared";
import {
  SCORING_CONFIDENCE_LABELS,
  SCORING_SOURCE_LABELS,
} from "@/components/keywords/score-cells";
import {
  difficultySignalLines,
  popularitySignalLines,
} from "@/components/keywords/score-signals";
import { GradedNumber, gradeFill } from "@/components/ui/graded";
import { InfoTip } from "@/components/ui/info-tip";
import { Meter } from "@/components/ui/meter";
import { grade, gradeLabel, type GradeMetric } from "@/lib/grade";
import {
  competitionFacts,
  newcomerCount,
  shownScore,
} from "./inspection-format";

const OPPORTUNITY_NOTE =
  "Opportunity weighs popularity against difficulty, before any app is considered.";

export const SUB_HEADER =
  "flex min-h-9 items-center justify-between gap-3 border-y px-4 text-label font-medium text-foreground";

function ScoreFigure({
  label,
  metric,
  value,
  was,
}: {
  label: string;
  metric: GradeMetric;
  value: number | null;
  was: number | null | undefined;
}) {
  const shown = shownScore(value);
  const graded = value === null ? null : grade(metric, Math.round(value));
  const note = [
    graded === null ? "not scored" : gradeLabel(graded),
    was === undefined || was === null ? null : `was ${shownScore(was)}`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 pt-3 pb-3.5 not-first:border-l">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-1.5">
        <GradedNumber
          value={shown}
          grade={graded}
          label={label}
          marker={false}
          className="text-metric leading-none font-semibold tracking-tight"
        />
        <Meter
          value={value ?? 0}
          fill={graded ? gradeFill(graded) : undefined}
        />
        <span className="text-caption text-faint-foreground">{note}</span>
      </dd>
    </div>
  );
}

export function InspectionFigures({
  inspection,
  previous,
}: {
  inspection: KeywordInspection;
  previous: KeywordInspectionDelta | null;
}) {
  return (
    <dl aria-label="Scores" className="grid grid-cols-3 border-b">
      <ScoreFigure
        label="Popularity"
        metric="popularity"
        value={inspection.volume}
        was={previous?.volume}
      />
      <ScoreFigure
        label="Difficulty"
        metric="difficulty"
        value={inspection.difficulty100}
        was={previous?.difficulty100}
      />
      <ScoreFigure
        label="Opportunity"
        metric="opportunity"
        value={inspection.opportunity}
        was={undefined}
      />
    </dl>
  );
}

export function InspectionSource({
  inspection,
}: {
  inspection: KeywordInspection;
}) {
  const { provenance, signals } = inspection;
  if (!provenance) return null;
  const explanation = [
    ...popularitySignalLines(signals, provenance.source, inspection.volume),
    ...difficultySignalLines(signals),
    OPPORTUNITY_NOTE,
  ].join(" ");
  return (
    <span>
      <span>
        {`${SCORING_SOURCE_LABELS[provenance.source]} · formula ${provenance.formulaVersion} · `}
      </span>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap align-middle">
        <span>{`${SCORING_CONFIDENCE_LABELS[provenance.confidence]} confidence`}</span>
        <InfoTip
          label="How these scores are estimated"
          title="How these scores are estimated"
          summary={explanation}
        />
      </span>
    </span>
  );
}

export function InspectionCompetition({
  inspection,
}: {
  inspection: KeywordInspection;
}) {
  const { competition } = inspection;
  if (!competition) return null;
  const facts = competitionFacts(
    competition,
    newcomerCount(
      inspection.results,
      competition.topCount,
      inspection.completedAt ?? inspection.requestedAt,
    ),
  );
  return (
    <section aria-labelledby="inspection-competition">
      <h3 id="inspection-competition" className={SUB_HEADER}>
        {`Competition in the top ${competition.topCount}`}
      </h3>
      <dl className="grid grid-cols-1 gap-x-6 px-4 pt-1 pb-3 sm:grid-cols-2">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-border-subtle py-2"
          >
            <dt className="text-dense text-muted-foreground">{fact.label}</dt>
            <dd className="numeric text-right text-dense font-medium">
              {fact.value}
            </dd>
            <dd className="col-span-2 text-caption text-faint-foreground">
              {fact.note}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
