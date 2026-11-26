import type {
  KeywordInspection,
  KeywordInspectionDelta,
  ScoringConfidence,
  ScoringSource,
} from "@asobeast/shared";
import { useTranslations } from "next-intl";
import {
  difficultySignalLines,
  popularitySignalLines,
} from "@/components/keywords/score-signals";
import { GradedNumber, gradeFill } from "@/components/ui/graded";
import { InfoTip } from "@/components/ui/info-tip";
import { Meter } from "@/components/ui/meter";
import { grade, gradeLabelInLocale, type GradeMetric } from "@/lib/grade";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  competitionFacts,
  newcomerCount,
  shownScore,
} from "./inspection-format";

const SCORE_SOURCE_KEYS: Record<ScoringSource, string> = {
  APPLE_SUGGEST_SEARCH: "appleSuggestSearch",
  GOOGLE_PLAY_PREFIX_SEARCH: "googlePlayPrefixSearch",
  APPLE_SUGGEST_REACH: "appleSuggestReach",
  GOOGLE_PLAY_SUGGEST_REACH: "googlePlaySuggestReach",
  APPLE_ADS_POPULARITY: "appleAdsPopularity",
  APPLE_SEARCH_SIGNALS: "appleSearchSignals",
};

const CONFIDENCE_KEYS: Record<ScoringConfidence, string> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

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
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  const shown = shownScore(value);
  const graded = value === null ? null : grade(metric, Math.round(value));
  const previous =
    was === undefined || was === null
      ? "none"
      : t("inspector.scores.was", { value: shownScore(was) });
  const note =
    graded === null
      ? t("inspector.scores.notScored")
      : t.rich("inspector.scores.note", {
          grade: gradeLabelInLocale(graded, locale),
          previous,
          was: (chunks) => <span>{chunks}</span>,
        });
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
  const t = useTranslations("keywordInspector");
  const keywords = useTranslations("keywords");
  return (
    <dl
      aria-label={t("inspector.scores.aria")}
      className="grid grid-cols-3 border-b"
    >
      <ScoreFigure
        label={keywords("table.popularity")}
        metric="popularity"
        value={inspection.volume}
        was={previous?.volume}
      />
      <ScoreFigure
        label={keywords("table.difficulty")}
        metric="difficulty"
        value={inspection.difficulty100}
        was={previous?.difficulty100}
      />
      <ScoreFigure
        label={keywords("table.opportunity")}
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
  const t = useTranslations("keywordInspector");
  const keywords = useTranslations("keywords");
  const { provenance, signals } = inspection;
  if (!provenance) return null;
  const explanation = [
    ...popularitySignalLines(
      signals,
      provenance.source,
      inspection.volume,
      keywords,
    ),
    ...difficultySignalLines(signals, keywords),
    t("inspector.scores.opportunityNote"),
  ].join(" ");
  const confidence = keywords(
    `scores.confidences.${CONFIDENCE_KEYS[provenance.confidence]}`,
  );
  return (
    <span>
      <span>
        {t("inspector.scores.formula", {
          source: keywords(
            `scores.sources.${SCORE_SOURCE_KEYS[provenance.source]}`,
          ),
          version: provenance.formulaVersion,
        })}
      </span>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap align-middle">
        <span>{keywords("scores.confidenceSummary", { confidence })}</span>
        <InfoTip
          label={t("inspector.scores.estimatedTitle")}
          title={t("inspector.scores.estimatedTitle")}
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
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  const { competition } = inspection;
  if (!competition) return null;
  const facts = competitionFacts(
    competition,
    newcomerCount(
      inspection.results,
      competition.topCount,
      inspection.completedAt ?? inspection.requestedAt,
    ),
    t,
    locale,
  );
  return (
    <section aria-labelledby="inspection-competition">
      <h3 id="inspection-competition" className={SUB_HEADER}>
        {t("inspector.scores.competitionTitle", {
          count: competition.topCount,
        })}
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
