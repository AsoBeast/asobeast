"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createTranslator, useTranslations } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { ChartLine, LoaderCircle, StickyNote } from "lucide-react";
import { DeltaChip } from "@/components/ui/delta-chip";
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
import {
  formatDateInLocale,
  formatMonthInLocale,
  formatNumberInLocale,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { isChecking, lostPosition, staleCheckDay } from "@/lib/keyword-checks";
import { tagsLabel, visibleTags } from "@/lib/keyword-tags";
import { NoSearchTermsContext } from "./PlayInstallsTip";
import { PositionReadout } from "./PositionReadout";
import {
  PositionHistoryPopover,
  type PositionHistoryContext,
} from "./PositionHistoryPopover";
import { KeywordClassTag } from "./KeywordClassTag";
import { PositionTrend } from "./PositionTrend";
import {
  DEFAULT_TREND_WINDOW,
  TREND_WINDOW_DAYS,
  trendChecks,
  trendDelta,
  trendFrame,
  trendPeriod,
  type TrendSeries,
  type TrendState,
  type TrendWindow,
} from "@/lib/trend-window";
import { StaleCheckMark } from "./StaleCheckMark";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

function volatilityBand(
  value: number,
  t: MessageTranslator,
): { label: string; text: string } {
  if (value < 20)
    return { label: t("table.volatilityLow"), text: "text-muted-foreground" };
  if (value <= 50)
    return { label: t("table.volatilityMedium"), text: "text-foreground" };
  return { label: t("table.volatilityHigh"), text: "text-warning" };
}

export function CheckingMark() {
  const t = useTranslations("keywords");
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
      <span>{t("table.checking")}</span>
    </span>
  );
}

export function PositionCell({
  keyword,
  today,
}: {
  keyword: TrackedKeywordItem;
  today: string;
}) {
  const t = useTranslations("keywords");
  const label = formatCheckedPosition(
    keyword.latestPosition,
    keyword.latestDepth,
    keyword.latestResultCount,
  );
  if (label === null && isChecking(keyword)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span aria-label={t("table.checkingLabel")} className="inline-flex">
            <CheckingMark />
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("table.checkingHint")}</TooltipContent>
      </Tooltip>
    );
  }
  if (label === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-label={t("table.notCheckedLabel")}
            className="text-muted-foreground"
          >
            —
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("table.notCheckedHint")}</TooltipContent>
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
      {staleOn === null ? null : <StaleCheckMark day={staleOn} />}
    </span>
  );
}

export function TrendHeading({
  trendWindow,
  t = english,
}: {
  trendWindow: TrendWindow;
  t?: MessageTranslator;
}) {
  const prefixClass =
    trendWindow === DEFAULT_TREND_WINDOW ? undefined : "keywords-tight:hidden";
  return (
    <span>
      <span className={prefixClass}>{t("table.lastPrefix")}</span>
      <span>
        {t("table.trendDays", { days: TREND_WINDOW_DAYS[trendWindow] })}
      </span>
    </span>
  );
}

export function TrendCell({
  keyword,
  today,
  history,
  trendWindow,
  series,
  state = "ready",
}: {
  keyword: TrackedKeywordItem;
  today: string;
  history: PositionHistoryContext;
  trendWindow: TrendWindow;
  series: TrendSeries | undefined;
  state?: TrendState;
}) {
  const t = useTranslations("keywords");
  const label = formatCheckedPosition(
    keyword.latestPosition,
    keyword.latestDepth,
    keyword.latestResultCount,
  );
  const trend =
    state !== "ready" ? (
      <span className="shrink-0 whitespace-nowrap text-caption text-muted-foreground">
        {state === "pending" ? t("table.trendPending") : t("table.trendFailed")}
      </span>
    ) : (
      <>
        <PositionTrend
          checks={trendChecks(keyword, trendWindow, series)}
          frame={trendFrame(trendWindow, today)}
          checked={label !== null}
        />
        <DeltaChip
          value={trendDelta(keyword, trendWindow, series)}
          period={trendPeriod(trendWindow, t)}
          className={keyword.active ? undefined : "text-muted-foreground"}
        />
      </>
    );
  if (label === null) {
    return <span className="inline-flex items-center gap-2">{trend}</span>;
  }
  return (
    <PositionHistoryPopover
      keyword={keyword}
      label={label}
      staleOn={staleCheckDay(keyword, today)}
      {...history}
    >
      {trend}
    </PositionHistoryPopover>
  );
}

export function VolatilityCell({ value }: { value: number | null }) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  if (value === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground">—</span>
        </TooltipTrigger>
        <TooltipContent>{t("table.notEnoughSnapshots")}</TooltipContent>
      </Tooltip>
    );
  }
  const band = volatilityBand(value, t);
  return (
    <span
      className="inline-flex items-center justify-end gap-1.5"
      aria-label={t("table.volatilityLabel", {
        band: band.label,
        value: formatNumberInLocale(value, locale),
      })}
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
}: {
  value: PlayAcquisitions | null;
}) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  const noSearchTermsStatement = useContext(NoSearchTermsContext);
  if (!value) {
    const message = noSearchTermsStatement ?? t("table.noPlayData");
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
  const month = formatMonthInLocale(value.month, locale);
  const acquisitions = formatNumberInLocale(value.acquisitions, locale);
  const visitors = formatNumberInLocale(value.visitors, locale);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="numeric whitespace-nowrap"
          aria-label={t("table.playAcquisitionsLabel", {
            acquisitions,
            visitors,
            month,
          })}
        >
          <span>{acquisitions}</span>
          <span className="text-muted-foreground">{` · ${visitors}`}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {t("table.playAcquisitionsHint", { month })}
      </TooltipContent>
    </Tooltip>
  );
}

export function TagList({ tags }: { tags: readonly string[] }) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  if (tags.length === 0) return null;
  const { shown, hidden } = visibleTags(tags);
  const label = tagsLabel(tags, t, locale);
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
  const t = useTranslations("keywords");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("table.noteLabel", { note })}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:text-foreground"
        >
          <StickyNote className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={t("table.noteTitle")}
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

export const KeywordSheetContext = createContext<
  ((keywordId: string) => void) | null
>(null);

const KEYWORD_OPENER =
  "relative min-w-0 rounded-sm text-left underline decoration-transparent underline-offset-4 outline-none transition-colors after:absolute after:inset-x-0 after:-inset-y-3 hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring";

function KeywordName({
  keyword,
  children,
}: {
  keyword: TrackedKeywordItem;
  children: ReactNode;
}) {
  const openSheet = useContext(KeywordSheetContext);
  if (!openSheet) {
    return (
      <span title={keyword.text} className="truncate">
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      title={keyword.text}
      data-keyword-sheet={keyword.keywordId}
      className={KEYWORD_OPENER}
      onClick={() => openSheet(keyword.keywordId)}
    >
      <span className="block truncate">{children}</span>
    </button>
  );
}

export function KeywordCell({ keyword }: { keyword: TrackedKeywordItem }) {
  const t = useTranslations("keywords");
  const marks = useContext(ListingMarksContext);
  const onChart = useContext(ChartedKeywordsContext).has(keyword.keywordId);
  return (
    <span className="flex max-w-40 items-center gap-2 font-medium md:max-w-72 md:keywords-snug:max-w-52 md:keywords-cramped:max-w-44">
      <KeywordName keyword={keyword}>
        <MatchedText
          segments={marks ? keyword.matchedIn : null}
          fallback={keyword.text}
        />
        {onChart ? <span className="sr-only">{t("table.onChart")}</span> : null}
      </KeywordName>
      {onChart ? (
        <ChartLine
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      ) : null}
      <KeywordClassTag
        keywordClass={keyword.keywordClass}
        source={keyword.keywordClassSource}
        t={t}
      />
      {keyword.note ? <NoteButton note={keyword.note} /> : null}
      {!keyword.active ? (
        <Badge variant="secondary" className="shrink-0">
          {t("table.paused")}
        </Badge>
      ) : null}
    </span>
  );
}

export function AddedCell({ trackedAt }: { trackedAt: string | null }) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  if (trackedAt === null) {
    return (
      <span
        className="text-muted-foreground"
        aria-label={t("table.addedUnknown")}
      >
        —
      </span>
    );
  }
  return (
    <time dateTime={trackedAt} className="numeric whitespace-nowrap">
      {formatDateInLocale(trackedAt, locale)}
    </time>
  );
}

export function CompetitorsInTop10Cell({ value }: { value: number | null }) {
  const t = useTranslations("keywords");
  if (value === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="text-muted-foreground"
            aria-label={t("table.competitorsUnavailable")}
          >
            —
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {t("table.competitorsUnavailableHint")}
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <span
      className="numeric"
      aria-label={t("table.competitorsCount", { count: value })}
    >
      {value}
    </span>
  );
}

export function RevealCell({
  label,
  t = english,
}: {
  label: string | null;
  t?: MessageTranslator;
}) {
  if (label === null) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("table.revealUnavailable")}</span>
      </span>
    );
  }
  return <span className="numeric">{label}</span>;
}
