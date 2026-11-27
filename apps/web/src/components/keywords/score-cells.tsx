"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownToLine, RefreshCcw } from "lucide-react";
import type {
  ScoreProvenance,
  ScoringConfidence,
  ScoringSource,
} from "@asobeast/shared";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/meter";
import { gradeFill } from "@/components/ui/graded";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateTimeInLocale } from "@/lib/format";
import { grade, gradeLabelInLocale, type GradeMetric } from "@/lib/grade";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";

type ScoreMetric = Extract<
  GradeMetric,
  "popularity" | "difficulty" | "opportunity"
>;

const SCORE_STACK = "ml-auto flex w-14 flex-col items-end gap-1 numeric";

const SCORING_SOURCE_KEYS: Record<ScoringSource, string> = {
  APPLE_SUGGEST_SEARCH: "appleSuggestSearch",
  GOOGLE_PLAY_PREFIX_SEARCH: "googlePlayPrefixSearch",
  APPLE_SUGGEST_REACH: "appleSuggestReach",
  GOOGLE_PLAY_SUGGEST_REACH: "googlePlaySuggestReach",
  APPLE_ADS_POPULARITY: "appleAdsPopularity",
  APPLE_SEARCH_SIGNALS: "appleSearchSignals",
};

const SCORING_CONFIDENCE_KEYS: Record<ScoringConfidence, string> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

export const SCORING_SOURCE_LABELS: Record<ScoringSource, string> = {
  APPLE_SUGGEST_SEARCH: enKeywords.scores.sources.appleSuggestSearch,
  GOOGLE_PLAY_PREFIX_SEARCH: enKeywords.scores.sources.googlePlayPrefixSearch,
  APPLE_SUGGEST_REACH: enKeywords.scores.sources.appleSuggestReach,
  GOOGLE_PLAY_SUGGEST_REACH: enKeywords.scores.sources.googlePlaySuggestReach,
  APPLE_ADS_POPULARITY: enKeywords.scores.sources.appleAdsPopularity,
  APPLE_SEARCH_SIGNALS: enKeywords.scores.sources.appleSearchSignals,
};

export const SCORING_CONFIDENCE_LABELS: Record<ScoringConfidence, string> = {
  LOW: enKeywords.scores.confidences.low,
  MEDIUM: enKeywords.scores.confidences.medium,
  HIGH: enKeywords.scores.confidences.high,
};

export function ScoreReadout({
  value,
  label,
  metric,
  emphasize,
  outdated,
  floorAnswer,
  className,
}: {
  value: number;
  label: string;
  metric: GradeMetric;
  emphasize?: boolean;
  outdated?: boolean;
  floorAnswer?: boolean;
  className?: string;
}) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  const graded = grade(metric, value);
  const gradeWords = graded
    ? t("scores.gradeSuffix", { grade: gradeLabelInLocale(graded, locale) })
    : "";
  const spoken = [
    t("scores.valueWithGrade", { label, value, grade: gradeWords }),
    ...(outdated ? [t("scores.olderFormula")] : []),
    ...(floorAnswer ? [t("scores.floorAnswer")] : []),
  ].join(". ");
  return (
    <span
      data-grade={graded ?? undefined}
      title={spoken}
      className={cn(
        SCORE_STACK,
        emphasize ? "font-semibold" : "font-medium",
        outdated && "text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden className="inline-flex items-center gap-1">
        {outdated ? <RefreshCcw className="size-3" /> : null}
        {floorAnswer ? (
          <ArrowDownToLine className="size-3 text-muted-foreground" />
        ) : null}
        <span>{value}</span>
      </span>
      {graded ? <Meter value={value} fill={gradeFill(graded)} /> : null}
      <span className="sr-only">{spoken}</span>
    </span>
  );
}

function ScoreButton({
  value,
  label,
  metric,
  summary,
  emphasize,
  floorAnswer,
  outdated,
  children,
}: {
  value: number | null;
  label: string;
  metric: ScoreMetric;
  summary: string;
  emphasize?: boolean;
  floorAnswer?: boolean;
  outdated?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  if (value === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-label={t("scores.notScoredLabel", { label })}
            className="text-muted-foreground"
          >
            —
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("scores.notScored")}</TooltipContent>
      </Tooltip>
    );
  }
  const valueLabel = Math.round(value);
  const graded = grade(metric, valueLabel);
  const gradeWords = graded
    ? t("scores.gradeSuffix", { grade: gradeLabelInLocale(graded, locale) })
    : "";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-grade={graded ?? undefined}
          data-outdated={outdated || undefined}
          aria-label={t("scores.buttonLabel", {
            label,
            value: valueLabel,
            grade: gradeWords,
            summary,
          })}
          className={cn(
            SCORE_STACK,
            "rounded-sm outline-none transition-shadow duration-150 ease-out hover:bg-card hover:shadow-[0_0_0_3px_var(--card),0_0_0_4px_var(--border)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            outdated ? "text-muted-foreground" : "text-foreground",
            emphasize ? "font-semibold" : "font-medium",
          )}
        >
          <span className="inline-flex items-center gap-1">
            {outdated ? (
              <RefreshCcw
                aria-hidden="true"
                className="size-3 text-muted-foreground"
              />
            ) : null}
            {floorAnswer ? (
              <ArrowDownToLine
                aria-hidden="true"
                className="size-3 text-muted-foreground"
              />
            ) : null}
            <span>{valueLabel}</span>
          </span>
          {graded ? <Meter value={value} fill={gradeFill(graded)} /> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        aria-label={t("scores.detailsLabel", { label })}
        className="w-80 max-w-(--radix-popover-content-available-width) items-start gap-1.5 p-3 text-left text-body font-normal whitespace-normal text-muted-foreground"
      >
        <p className="text-heading text-foreground">
          {t("scores.valueWithGrade", {
            label,
            value: valueLabel,
            grade: gradeWords,
          })}
        </p>
        {children}
      </PopoverContent>
    </Popover>
  );
}

function scoreSummary(
  provenance: ScoreProvenance | null,
  outdated: boolean | undefined,
  floorAnswer: boolean | undefined,
  t: MessageTranslator,
): string {
  if (outdated) {
    return t("scores.olderFormula");
  }
  const confidence = provenance
    ? t("scores.confidenceSummary", {
        confidence: t(
          `scores.confidences.${SCORING_CONFIDENCE_KEYS[provenance.confidence]}`,
        ),
      })
    : t("scores.legacyScore");
  return floorAnswer ? t("scores.floorSummary", { confidence }) : confidence;
}

function DetailList({ lines }: { lines?: string[] }) {
  return lines && lines.length > 0 ? (
    <ul className="flex flex-col gap-1">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  ) : null;
}

export function ScoreDetails({
  provenance,
  details,
  outdated,
}: {
  provenance: ScoreProvenance | null;
  details?: string[];
  outdated?: boolean;
}) {
  const t = useTranslations("keywords");
  return (
    <>
      {outdated ? <span>{t("scores.outdatedDetail")}</span> : null}
      <DetailList lines={details} />
      <ScoreProvenanceDetails provenance={provenance} />
    </>
  );
}

export function DerivedScoreDetails({ details }: { details?: string[] }) {
  const t = useTranslations("keywords");
  return (
    <>
      <span>{t("scores.derivedDetail")}</span>
      <DetailList lines={details} />
    </>
  );
}

export function ScoreCell({
  value,
  label,
  metric,
  provenance,
  details,
  outdated,
  emphasize,
  floorAnswer,
}: {
  value: number | null;
  label: string;
  metric: ScoreMetric;
  provenance: ScoreProvenance | null;
  details?: string[];
  outdated?: boolean;
  emphasize?: boolean;
  floorAnswer?: boolean;
}) {
  const t = useTranslations("keywords");
  return (
    <ScoreButton
      value={value}
      label={label}
      metric={metric}
      emphasize={emphasize}
      floorAnswer={floorAnswer}
      outdated={outdated}
      summary={scoreSummary(provenance, outdated, floorAnswer, t)}
    >
      <ScoreDetails
        provenance={provenance}
        details={details}
        outdated={outdated}
      />
    </ScoreButton>
  );
}

export function DerivedScoreCell({
  value,
  label,
  metric,
  emphasize,
  details,
  lowerConfidence,
}: {
  value: number | null;
  label: string;
  metric: ScoreMetric;
  emphasize?: boolean;
  details?: string[];
  lowerConfidence?: boolean;
}) {
  const t = useTranslations("keywords");
  return (
    <ScoreButton
      value={value}
      label={label}
      metric={metric}
      emphasize={emphasize}
      summary={
        lowerConfidence
          ? t("scores.derivedLowerSummary")
          : t("scores.derivedSummary")
      }
    >
      <DerivedScoreDetails details={details} />
    </ScoreButton>
  );
}

function capturedAtLabel(
  value: string,
  t: MessageTranslator,
  locale: Locale,
): string {
  return Number.isNaN(new Date(value).getTime())
    ? t("scores.capturedUnavailable")
    : formatDateTimeInLocale(value, locale);
}

function ScoreProvenanceDetails({
  provenance,
}: {
  provenance: ScoreProvenance | null;
}) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  if (!provenance) {
    return <span>{t("scores.legacyProvenance")}</span>;
  }
  const confidence = t(
    `scores.confidences.${SCORING_CONFIDENCE_KEYS[provenance.confidence]}`,
  );
  return (
    <>
      <span>
        {t(`scores.sources.${SCORING_SOURCE_KEYS[provenance.source]}`)}
      </span>
      <span>{t("scores.formula", { version: provenance.formulaVersion })}</span>
      <span>{capturedAtLabel(provenance.capturedAt, t, locale)}</span>
      <Badge variant="secondary">
        {t("scores.confidenceSummary", { confidence })}
      </Badge>
      <span className="text-caption">{t("scores.confidenceNote")}</span>
    </>
  );
}
