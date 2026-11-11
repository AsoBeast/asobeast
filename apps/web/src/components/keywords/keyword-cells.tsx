"use client";

import { createContext, useContext } from "react";
import { ChartLine, LoaderCircle, StickyNote } from "lucide-react";
import type { PlayAcquisitions, TrackedKeywordItem } from "@asobeast/shared";
import { formatCheckedPosition } from "@asobeast/shared";
import { MatchedText } from "@/components/keyword-match/MatchedText";
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
import { formatDate, formatMonth, formatNumber, pluralize } from "@/lib/format";
import { isChecking, lostPosition, staleCheckDay } from "@/lib/keyword-checks";
import { tagsLabel, visibleTags } from "@/lib/keyword-tags";
import { PositionReadout } from "./PositionReadout";
import {
  PositionHistoryPopover,
  type PositionHistoryContext,
} from "./PositionHistoryPopover";
import { KeywordClassTag } from "./KeywordClassTag";

function volatilityBand(value: number): { label: string; text: string } {
  if (value < 20) return { label: "Low", text: "text-muted-foreground" };
  if (value <= 50) return { label: "Medium", text: "text-foreground" };
  return { label: "High", text: "text-warning" };
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
      <PositionReadout
        keyword={keyword}
        label={label}
        staleOn={staleOn}
        lost={lostPosition(keyword)}
        chip
      />
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
      className="inline-flex items-center justify-end gap-1.5"
      aria-label={`${band.label} volatility, ${value} out of 100`}
    >
      <span className={band.text}>{band.label}</span>
      <span className="numeric w-6 text-right text-muted-foreground">
        {value}
      </span>
    </span>
  );
}

export function PlayAcquisitionsCell({
  value,
  noSearchTermsStatement,
}: {
  value: PlayAcquisitions | null;
  noSearchTermsStatement?: string | null;
}) {
  if (!value) {
    const message = noSearchTermsStatement ?? "No Play Console data";
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground" aria-label={message}>
            —
          </span>
        </TooltipTrigger>
        <TooltipContent>{message}</TooltipContent>
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
          className="numeric whitespace-nowrap"
          aria-label={`${acquisitions} acquisitions from ${visitors} store listing visitors in ${month}`}
        >
          <span>{acquisitions}</span>
          <span className="text-muted-foreground">{` · ${visitors}`}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {`Store listing acquisitions and visitors from this search term in ${month}`}
      </TooltipContent>
    </Tooltip>
  );
}

export function TagList({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) return null;
  const { shown, hidden } = visibleTags(tags);
  const label = tagsLabel(tags);
  return (
    <span
      role="group"
      aria-label={label}
      title={label}
      className="flex items-center gap-1 whitespace-nowrap text-muted-foreground"
    >
      <span aria-hidden>{shown.join(", ")}</span>
      {hidden > 0 ? (
        <span aria-hidden className="text-caption text-faint-foreground">
          {`+${hidden}`}
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

export const ListingMarksContext = createContext(true);

export const ChartedKeywordsContext = createContext<ReadonlySet<string>>(
  new Set(),
);

export function KeywordCell({ keyword }: { keyword: TrackedKeywordItem }) {
  const marks = useContext(ListingMarksContext);
  const onChart = useContext(ChartedKeywordsContext).has(keyword.keywordId);
  return (
    <span className="flex max-w-40 items-center gap-2 font-medium md:max-w-72">
      <span title={keyword.text} className="truncate">
        <MatchedText
          segments={marks ? keyword.matchedIn : null}
          fallback={keyword.text}
        />
        {onChart ? <span className="sr-only">, on the chart</span> : null}
      </span>
      {onChart ? (
        <ChartLine
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      ) : null}
      <KeywordClassTag
        keywordClass={keyword.keywordClass}
        source={keyword.keywordClassSource}
      />
      {keyword.note ? <NoteButton note={keyword.note} /> : null}
      {!keyword.active ? (
        <Badge variant="secondary" className="shrink-0">
          Paused
        </Badge>
      ) : null}
    </span>
  );
}

export function AddedCell({ trackedAt }: { trackedAt: string | null }) {
  if (trackedAt === null) {
    return (
      <span className="text-muted-foreground" aria-label="Added: unknown">
        —
      </span>
    );
  }
  return (
    <time dateTime={trackedAt} className="numeric whitespace-nowrap">
      {formatDate(trackedAt)}
    </time>
  );
}

export function CompetitorsInTop10Cell({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="text-muted-foreground"
            aria-label="Competitors in top 10: not available"
          >
            —
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          No competitors tracked, or no top 10 snapshot from today or yesterday
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <span
      className="numeric"
      aria-label={`${pluralize(value, "competitor")} in the top 10`}
    >
      {value}
    </span>
  );
}

export function RevealCell({ label }: { label: string | null }) {
  if (label === null) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Reveal: not available</span>
      </span>
    );
  }
  return <span className="numeric">{label}</span>;
}
