"use client";

import {
  KEYWORD_INSPECTION_LIST_LIMIT,
  type KeywordInspectionSummary,
} from "@asobeast/shared";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useZoneThresholds } from "@/components/keywords/use-zone-thresholds";
import { PANEL_BLEED, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatCountryInLocale,
  formatDateTimeInLocale,
  formatDayMonthInLocale,
  storeLabel,
} from "@/lib/format";
import { zoneLabel, zoneOf, type ZoneThresholds } from "@/lib/keyword-zones";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import { cn } from "@/lib/utils";
import { DeleteInspectionButton } from "./DeleteInspectionButton";
import { shownScore, storefrontCode } from "./inspection-format";

const ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 @[38rem]/log:grid-cols-[minmax(0,1fr)_7.25rem_repeat(3,4.75rem)_3.75rem_1.75rem]";

const SCORE = "numeric hidden text-right @[38rem]/log:block";

function zoneWord(
  item: KeywordInspectionSummary,
  thresholds: ZoneThresholds,
  keywords: MessageTranslator,
  noScore: string,
): string {
  if (item.volume === null || item.difficulty100 === null) {
    return noScore;
  }
  const zone = zoneOf(
    {
      popularity: Math.round(item.volume),
      difficulty: Math.round(item.difficulty100),
    },
    thresholds,
  );
  return zone === null ? noScore : zoneLabel(zone, keywords);
}

function RunState({ item }: { item: KeywordInspectionSummary }) {
  const t = useTranslations("keywordInspector");
  if (item.status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
        <span>{t("inspector.log.running")}</span>
      </span>
    );
  }
  return (
    <span className="font-medium text-signal-down">
      {t("inspector.log.failed")}
    </span>
  );
}

function LogRow({
  item,
  selected,
  thresholds,
  onSelect,
  onDeleted,
}: {
  item: KeywordInspectionSummary;
  selected: boolean;
  thresholds: ZoneThresholds;
  onSelect: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("keywordInspector");
  const keywords = useTranslations("keywords");
  const locale = useAppLocale();
  const done = item.status === "DONE";
  const storefront = storefrontCode(item.store, item.country);
  const day = formatDayMonthInLocale(
    item.completedAt ?? item.requestedAt,
    locale,
  );
  const noScore = t("inspector.log.noScore");
  const zone = zoneWord(item, thresholds, keywords, noScore);
  return (
    <li
      className={cn(
        ROW,
        "relative min-h-10 rounded-md px-2 text-dense transition-colors duration-150 ease-out hover:bg-muted @[38rem]/log:min-h-9",
        selected &&
          "bg-muted before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground",
      )}
    >
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={() => onSelect(item.id)}
        className="grid min-w-0 items-center gap-x-2 gap-y-0.5 rounded-sm py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring @[38rem]/log:col-span-6 @[38rem]/log:grid-cols-subgrid @[38rem]/log:py-0"
      >
        <span className="min-w-0 truncate font-medium">
          <bdi>{item.keyword}</bdi>
        </span>
        <span className="truncate text-caption text-muted-foreground @[38rem]/log:hidden">
          {done ? (
            <span>{`${storefront} · ${zone} · ${day}`}</span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <RunState item={item} />
              <span>{`· ${storefront} · ${day}`}</span>
            </span>
          )}
        </span>
        <span className="hidden truncate text-muted-foreground @[38rem]/log:block">
          {storefront}
        </span>
        {done ? (
          <>
            <span className={SCORE}>{shownScore(item.volume)}</span>
            <span className={SCORE}>{shownScore(item.difficulty100)}</span>
            <span className={SCORE}>{shownScore(item.opportunity)}</span>
          </>
        ) : (
          <span className="hidden @[38rem]/log:col-span-3 @[38rem]/log:block">
            <RunState item={item} />
          </span>
        )}
        <span className="numeric hidden pl-2 text-muted-foreground @[38rem]/log:block">
          {day}
        </span>
      </button>
      <DeleteInspectionButton
        id={item.id}
        keyword={item.keyword}
        subject={t("inspector.log.deleteSubject", {
          keyword: item.keyword,
          store: storeLabel(item.store),
          country: formatCountryInLocale(item.country, locale),
          date: formatDateTimeInLocale(item.requestedAt, locale),
        })}
        onDeleted={onDeleted}
      />
    </li>
  );
}

const storefrontCount = (items: readonly KeywordInspectionSummary[]) =>
  new Set(items.map((item) => `${item.store}|${item.country}`)).size;

export function InspectionLog({
  items,
  selected,
  onSelect,
  onDeleted,
}: {
  items: readonly KeywordInspectionSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("keywordInspector");
  const { thresholds } = useZoneThresholds();
  return (
    <Card
      aria-labelledby="inspection-log"
      className="@container/log min-w-0"
      role="region"
    >
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2 id="inspection-log">{t("inspector.log.title")}</h2>
        </CardTitle>
        {items.length > 0 ? (
          <CardAction className="numeric self-center text-label text-faint-foreground">
            {t("inspector.log.count", {
              count: items.length,
              limit: KEYWORD_INSPECTION_LIST_LIMIT,
            })}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className={items.length === 0 ? undefined : PANEL_BLEED}>
        {items.length === 0 ? (
          <EmptyState
            title={t("inspector.log.emptyTitle")}
            body={t("inspector.log.emptyBody")}
            className="py-8"
          />
        ) : (
          <div className="p-2">
            <div
              aria-hidden
              className={cn(
                ROW,
                "hidden min-h-9 border-b px-2 text-label text-faint-foreground @[38rem]/log:grid",
              )}
            >
              <span>{t("inspector.log.keyword")}</span>
              <span>{t("inspector.log.storefront")}</span>
              <span className="text-right">
                {t("inspector.log.popularity")}
              </span>
              <span className="text-right">
                {t("inspector.log.difficulty")}
              </span>
              <span className="text-right">
                {t("inspector.log.opportunity")}
              </span>
              <span className="pl-2">{t("inspector.log.inspected")}</span>
              <span />
            </div>
            <ul className="flex flex-col pt-1">
              {items.map((item) => (
                <LogRow
                  key={item.id}
                  item={item}
                  selected={item.id === selected}
                  thresholds={thresholds}
                  onSelect={onSelect}
                  onDeleted={onDeleted}
                />
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      {items.length > 0 ? (
        <CardFooter>
          <span>
            {t("inspector.log.footer", {
              inspections: t("inspector.log.inspectionCount", {
                count: items.length,
              }),
              storefronts: t("inspector.log.storefrontCount", {
                count: storefrontCount(items),
              }),
              limit: KEYWORD_INSPECTION_LIST_LIMIT,
            })}
          </span>
        </CardFooter>
      ) : null}
    </Card>
  );
}
