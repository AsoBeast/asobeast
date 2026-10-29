"use client";

import type { ReactNode } from "react";
import { ArrowDownToLine } from "lucide-react";
import type {
  ScoreProvenance,
  ScoringConfidence,
  ScoringSource,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/meter";
import { gradeFill } from "@/components/ui/graded";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateTime } from "@/lib/format";
import { grade, gradeLabel, type GradeMetric } from "@/lib/grade";
import { cn } from "@/lib/utils";

const OUTDATED_SCORE_DETAIL =
  "Scored by an older formula. It is rescored automatically; the new number replaces this one within a day.";

const DERIVED_SCORE_DETAIL =
  "Calculated from popularity and difficulty when the list loaded, so it carries no stored capture time. It is the same for every app that tracks the keyword.";

type ScoreMetric = Extract<
  GradeMetric,
  "popularity" | "difficulty" | "opportunity"
>;

function ScoreButton({
  value,
  label,
  metric,
  summary,
  emphasize,
  floorAnswer,
  children,
}: {
  value: number | null;
  label: string;
  metric: ScoreMetric;
  summary: string;
  emphasize?: boolean;
  floorAnswer?: boolean;
  children: ReactNode;
}) {
  if (value === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-label={`${label}: not scored yet`}
            className="text-muted-foreground"
          >
            —
          </span>
        </TooltipTrigger>
        <TooltipContent>Not scored yet</TooltipContent>
      </Tooltip>
    );
  }
  const valueLabel = Math.round(value);
  const graded = grade(metric, valueLabel);
  const gradeWords = graded ? `, ${gradeLabel(graded)}` : "";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-grade={graded ?? undefined}
          aria-label={`${label} ${valueLabel}${gradeWords}. ${summary}. Show scoring details`}
          className={cn(
            "flex w-14 flex-col items-end gap-1 rounded-sm numeric font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            emphasize
              ? "font-semibold text-foreground"
              : "text-muted-foreground",
          )}
        >
          <span className="inline-flex items-center gap-1">
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
      </TooltipTrigger>
      <TooltipContent className="max-w-sm flex-col items-start gap-1.5">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function scoreSummary(
  provenance: ScoreProvenance | null,
  outdated?: boolean,
  floorAnswer?: boolean,
): string {
  if (outdated) {
    return "Older formula";
  }
  const confidence = provenance
    ? `${SCORING_CONFIDENCE_LABELS[provenance.confidence]} confidence`
    : "Legacy score";
  return floorAnswer ? `Floor answer, ${confidence}` : confidence;
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
  return (
    <ScoreButton
      value={value}
      label={label}
      metric={metric}
      emphasize={emphasize}
      floorAnswer={floorAnswer}
      summary={scoreSummary(provenance, outdated, floorAnswer)}
    >
      {outdated ? <span>{OUTDATED_SCORE_DETAIL}</span> : null}
      <DetailList lines={details} />
      <ScoreProvenanceDetails provenance={provenance} />
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
  return (
    <ScoreButton
      value={value}
      label={label}
      metric={metric}
      emphasize={emphasize}
      summary={
        lowerConfidence ? "Derived score, lower confidence" : "Derived score"
      }
    >
      <span>{DERIVED_SCORE_DETAIL}</span>
      <DetailList lines={details} />
    </ScoreButton>
  );
}

export const SCORING_SOURCE_LABELS: Record<ScoringSource, string> = {
  APPLE_SUGGEST_SEARCH: "Apple suggest and search",
  GOOGLE_PLAY_PREFIX_SEARCH: "Google Play prefix suggest and search",
  APPLE_SUGGEST_REACH: "App Store suggest reach",
  GOOGLE_PLAY_SUGGEST_REACH: "Google Play suggest reach",
  APPLE_ADS_POPULARITY: "Apple Ads search popularity",
  APPLE_SEARCH_SIGNALS: "App Store search signals",
};

export const SCORING_CONFIDENCE_LABELS: Record<ScoringConfidence, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

function capturedAtLabel(value: string): string {
  return Number.isNaN(new Date(value).getTime())
    ? "Capture time unavailable"
    : formatDateTime(value);
}

function ScoreProvenanceDetails({
  provenance,
}: {
  provenance: ScoreProvenance | null;
}) {
  if (!provenance) {
    return <span>Legacy score — provenance unavailable</span>;
  }
  const confidence = SCORING_CONFIDENCE_LABELS[provenance.confidence];
  return (
    <>
      <span>{SCORING_SOURCE_LABELS[provenance.source]}</span>
      <span>Formula {provenance.formulaVersion}</span>
      <span>{capturedAtLabel(provenance.capturedAt)}</span>
      <Badge variant="secondary">{confidence} confidence</Badge>
      <span className="max-w-xs text-background">
        Confidence measures input completeness, not ranking accuracy.
      </span>
    </>
  );
}
