"use client";

import { LoaderCircle, StickyNote } from "lucide-react";
import type { PlayAcquisitions, TrackedKeywordItem } from "@asobeast/shared";
import { formatCheckedPosition } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
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
import { formatMonth, formatNumber } from "@/lib/format";
import { isChecking, staleCheckDay } from "@/lib/keyword-checks";
import { tagsLabel, visibleTags } from "@/lib/keyword-tags";
import { PositionReadout } from "./PositionReadout";
import {
  PositionHistoryPopover,
  type PositionHistoryContext,
} from "./PositionHistoryPopover";
import { cn } from "@/lib/utils";

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

export function PositionCell({
  keyword,
  today,
  history,
}: {
  keyword: TrackedKeywordItem;
  today: string;
  history: PositionHistoryContext;
}) {
  const label = formatCheckedPosition(
    keyword.latestPosition,
    keyword.latestDepth,
  );
  if (label === null && isChecking(keyword)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-label="Position: checking"
            className="inline-flex items-center gap-1.5 text-muted-foreground"
          >
            <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
            Checking…
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Queued for its first check. Scores can land first; the table updates
          on its own.
        </TooltipContent>
      </Tooltip>
    );
  }
  if (label === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-label="Position: not checked yet"
            className="text-muted-foreground"
          >
            —
          </span>
        </TooltipTrigger>
        <TooltipContent>This keyword has not been checked yet</TooltipContent>
      </Tooltip>
    );
  }
  const staleOn = staleCheckDay(keyword, today);
  return (
    <span className="inline-flex items-center gap-1">
      <PositionReadout keyword={keyword} label={label} staleOn={staleOn} />
      <PositionHistoryPopover
        keyword={keyword}
        label={label}
        staleOn={staleOn}
        {...history}
      />
    </span>
  );
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

export function PlayAcquisitionsCell({
  value,
}: {
  value: PlayAcquisitions | null;
}) {
  if (!value) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="text-muted-foreground"
            aria-label="No Play Console data"
          >
            —
          </span>
        </TooltipTrigger>
        <TooltipContent>No Play Console data</TooltipContent>
      </Tooltip>
    );
  }
  const month = formatMonth(value.month);
  const acquisitions = formatNumber(value.acquisitions);
  const visitors = formatNumber(value.visitors);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="numeric font-mono text-sm whitespace-nowrap"
          aria-label={`${acquisitions} acquisitions from ${visitors} store listing visitors in ${month}`}
        >
          {acquisitions}
          <span className="text-muted-foreground"> · {visitors}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Store listing acquisitions and visitors from this search term in {month}
      </TooltipContent>
    </Tooltip>
  );
}

export function TagBadges({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) return null;
  const { shown, hidden } = visibleTags(tags);
  const label = tagsLabel(tags);
  return (
    <span
      role="group"
      aria-label={label}
      title={label}
      className="flex items-center gap-1 whitespace-nowrap"
    >
      {shown.map((tag) => (
        <Badge key={tag} variant="outline" aria-hidden>
          {tag}
        </Badge>
      ))}
      {hidden > 0 ? (
        <span aria-hidden className="text-caption text-muted-foreground">
          +{hidden}
        </span>
      ) : null}
    </span>
  );
}

export function NoteButton({ note }: { note: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Note: ${note}`}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:text-foreground"
        >
          <StickyNote className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label="Keyword note"
        className="w-auto max-w-[min(24rem,calc(100vw-2rem))] font-normal break-words whitespace-pre-line"
      >
        {note}
      </PopoverContent>
    </Popover>
  );
}
