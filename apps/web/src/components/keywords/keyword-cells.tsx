"use client";

import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type {
  KeywordSort,
  ScoreProvenance,
  ScoringConfidence,
  ScoringSource,
  TrackedKeywordItem,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Meter, type MeterTone } from "@/components/ui/meter";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function scoreValue(
  keyword: TrackedKeywordItem,
  column: KeywordSort,
): number | null {
  switch (column) {
    case "traffic":
      return keyword.volume;
    case "difficulty":
      return keyword.difficulty === null ? null : keyword.difficulty * 10;
    case "opportunity":
      return keyword.opportunity;
    default:
      return null;
  }
}

const DERIVED_SCORE_DETAIL =
  "Calculated from traffic, difficulty and this app's keyword relevance when the list loaded, so it carries no stored capture time.";

function ScoreButton({
  value,
  label,
  summary,
  emphasize,
  tone = "score",
  children,
}: {
  value: number | null;
  label: string;
  summary: string;
  emphasize?: boolean;
  tone?: MeterTone | "none";
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
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${label} ${valueLabel}. ${summary}. Show scoring details`}
          className={cn(
            "flex w-14 flex-col items-end gap-1 rounded-sm numeric font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            emphasize
              ? "font-semibold text-foreground"
              : "text-muted-foreground",
          )}
        >
          {valueLabel}
          {tone === "none" ? null : <Meter value={value} tone={tone} />}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm flex-col items-start gap-1.5">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

export function ScoreCell({
  value,
  label,
  provenance,
  emphasize,
  tone,
}: {
  value: number | null;
  label: string;
  provenance: ScoreProvenance | null;
  emphasize?: boolean;
  tone?: MeterTone | "none";
}) {
  return (
    <ScoreButton
      value={value}
      label={label}
      emphasize={emphasize}
      tone={tone}
      summary={
        provenance
          ? `${SCORING_CONFIDENCE_LABELS[provenance.confidence]} confidence`
          : "Legacy score"
      }
    >
      <ScoreProvenanceDetails provenance={provenance} />
    </ScoreButton>
  );
}

export function DerivedScoreCell({
  value,
  label,
  emphasize,
}: {
  value: number | null;
  label: string;
  emphasize?: boolean;
}) {
  return (
    <ScoreButton
      value={value}
      label={label}
      emphasize={emphasize}
      tone="opportunity"
      summary="Derived score"
    >
      <span>{DERIVED_SCORE_DETAIL}</span>
    </ScoreButton>
  );
}

export const SCORING_SOURCE_LABELS: Record<ScoringSource, string> = {
  APPLE_SUGGEST_SEARCH: "Apple suggest and search",
  GOOGLE_PLAY_PREFIX_SEARCH: "Google Play prefix suggest and search",
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
      <span className="max-w-xs text-background/80">
        Confidence measures input completeness, not ranking accuracy.
      </span>
    </>
  );
}

function volatilityBand(value: number): {
  label: string;
  text: string;
  dot: string;
} {
  if (value < 20) {
    return {
      label: "Low",
      text: "text-muted-foreground",
      dot: "bg-muted-foreground/60",
    };
  }
  if (value <= 50) {
    return {
      label: "Medium",
      text: "text-warning",
      dot: "bg-warning",
    };
  }
  return {
    label: "High",
    text: "text-signal-down",
    dot: "bg-signal-down",
  };
}

export function VolatilityCell({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground">—</span>
        </TooltipTrigger>
        <TooltipContent>Not enough snapshots yet</TooltipContent>
      </Tooltip>
    );
  }
  const band = volatilityBand(value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium",
        band.text,
      )}
      aria-label={`${band.label} volatility, ${value} out of 100`}
    >
      <span className={cn("size-2 rounded-full", band.dot)} aria-hidden />
      {band.label}
      <span className="numeric font-mono text-xs text-muted-foreground">
        {value}
      </span>
    </span>
  );
}

export function SortHeader({
  column,
  label,
  active,
  onSort,
  className,
  ...props
}: ComponentProps<"button"> & {
  column: KeywordSort;
  label: string;
  active: boolean;
  onSort: (column: KeywordSort) => void;
}) {
  return (
    <button
      {...props}
      type="button"
      onClick={() => onSort(column)}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 transition-colors",
        active ? "text-foreground" : "hover:text-foreground",
        className,
      )}
    >
      {label}
      {active ? <ChevronDown className="size-3.5" /> : null}
    </button>
  );
}
