"use client";

import type { ReactNode } from "react";
import { ArrowDownToLine, RefreshCcw } from "lucide-react";
import type {
  ScoreProvenance,
  ScoringConfidence,
  ScoringSource,
} from "@asobeast/shared";
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

const SCORE_STACK = "ml-auto flex w-14 flex-col items-end gap-1 numeric";

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
  const graded = grade(metric, value);
  const spoken = [
    graded ? `${label} ${value}, ${gradeLabel(graded)}` : `${label} ${value}`,
    ...(outdated ? ["Older formula"] : []),
    ...(floorAnswer ? ["Floor answer"] : []),
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
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-grade={graded ?? undefined}
          data-outdated={outdated || undefined}
          aria-label={`${label} ${valueLabel}${gradeWords}. ${summary}. Show scoring details`}
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
        aria-label={`${label} scoring details`}
        className="w-80 max-w-(--radix-popover-content-available-width) items-start gap-1.5 p-3 text-left text-body font-normal whitespace-normal text-muted-foreground"
      >
        <p className="text-heading text-foreground">{`${label} ${valueLabel}${gradeWords}`}</p>
        {children}
      </PopoverContent>
    </Popover>
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

export function ScoreDetails({
  provenance,
  details,
  outdated,
}: {
  provenance: ScoreProvenance | null;
  details?: string[];
  outdated?: boolean;
}) {
  return (
    <>
      {outdated ? <span>{OUTDATED_SCORE_DETAIL}</span> : null}
      <DetailList lines={details} />
      <ScoreProvenanceDetails provenance={provenance} />
    </>
  );
}

export function DerivedScoreDetails({ details }: { details?: string[] }) {
  return (
    <>
      <span>{DERIVED_SCORE_DETAIL}</span>
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
  return (
    <ScoreButton
      value={value}
      label={label}
      metric={metric}
      emphasize={emphasize}
      floorAnswer={floorAnswer}
      outdated={outdated}
      summary={scoreSummary(provenance, outdated, floorAnswer)}
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
      <DerivedScoreDetails details={details} />
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
      <span className="text-caption">
        Confidence measures input completeness, not ranking accuracy.
      </span>
    </>
  );
}
