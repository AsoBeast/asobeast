"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import type { SerpMoverItem } from "@asobeast/shared";
import { PANEL_ACTION, PANEL_HEADER } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { TrackButton } from "@/components/competitors/TrackButton";
import {
  formatCountryInLocale,
  formatDateInLocale,
  formatNumberInLocale,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { serpMoversOptions } from "@/lib/queries";
import { MOVER_WINDOWS, rangeLabel, type MoverWindow } from "@/lib/ranges";
import { countryParser, moverDaysParser } from "@/lib/search-params";
import { PrintRangeLabel } from "./RangePicker";

const WIDEST_WINDOW = MOVER_WINDOWS[MOVER_WINDOWS.length - 1];

const moverWindowId = (window: MoverWindow): string =>
  `serp-movers-window-${window}`;

function groupByDay(items: SerpMoverItem[]): [string, SerpMoverItem[]][] {
  const groups = new Map<string, SerpMoverItem[]>();
  for (const item of items) {
    const list = groups.get(item.date);
    if (list) {
      list.push(item);
    } else {
      groups.set(item.date, [item]);
    }
  }
  return [...groups.entries()];
}

function EntrantRow({ item, id }: { item: SerpMoverItem; id: string }) {
  const t = useTranslations("rankings");
  const owner =
    item.appId === id ? t("you") : item.isCompetitor ? t("competitor") : null;
  return (
    <li className="flex min-h-10 items-center gap-3 rounded-md px-2 py-1 text-dense transition-colors duration-150 ease-out hover:bg-muted sm:min-h-9">
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <bdi className="font-medium wrap-anywhere">{item.title}</bdi>
        <span className="text-muted-foreground">
          <bdi className="wrap-anywhere">{item.text}</bdi>
          <span className="numeric">{` · #${item.position}`}</span>
        </span>
      </span>
      {owner === null ? null : (
        <span className="shrink-0 text-caption text-faint-foreground">
          {owner}
        </span>
      )}
      {item.appId === null ? (
        <TrackButton
          id={id}
          storeAppId={item.storeAppId}
          title={item.title}
          label={t("trackApp", { title: item.title })}
          className="print:hidden"
        />
      ) : null}
    </li>
  );
}

function SerpMoversList({
  id,
  days,
  country,
  onWiden,
}: {
  id: string;
  days: MoverWindow;
  country: string | null;
  onWiden: () => void;
}) {
  const t = useTranslations("rankings");
  const locale = useAppLocale();
  const { data } = useSuspenseQuery(serpMoversOptions(id, days, country));
  const market = country ? formatCountryInLocale(country, locale) : null;

  if (data.items.length === 0) {
    return (
      <EmptyState
        title={t("noEntrants", { days })}
        body={market ? t("nobodyTop10Market", { market }) : t("nobodyTop10")}
        action={
          days === WIDEST_WINDOW ? null : (
            <Button
              variant="outline"
              size="sm"
              className="print:hidden"
              onClick={onWiden}
            >
              {t("lookBack", { days: WIDEST_WINDOW })}
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {groupByDay(data.items).map(([date, items]) => (
        <section key={date} aria-label={formatDateInLocale(date, locale)}>
          <h3 className="flex h-9 items-center gap-2 px-2 text-label">
            <span>{formatDateInLocale(date, locale)}</span>
            <span className="numeric font-normal text-faint-foreground">
              {formatNumberInLocale(items.length, locale)}
            </span>
          </h3>
          <ul className="flex flex-col">
            {items.map((item) => (
              <EntrantRow
                key={`${item.date}-${item.keywordId}-${item.storeAppId}`}
                item={item}
                id={id}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function SerpMoversSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-2" aria-hidden>
      <Skeleton className="my-2.5 h-4 w-24" />
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex h-9 items-center gap-3">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SerpMoversCard({ id }: { id: string }) {
  const t = useTranslations("rankings");
  const format = useTranslations("format");
  const locale = useAppLocale();
  const [days, setDays] = useQueryState("movers", moverDaysParser);
  const [country] = useQueryState("country", countryParser);

  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>{t("newInTop10")}</h2>
        </CardTitle>
        <CardAction className={PANEL_ACTION}>
          <Tabs
            value={String(days)}
            onValueChange={(next) => {
              const window = moverDaysParser.parse(next);
              if (window !== null) void setDays(window);
            }}
          >
            <TabsList
              aria-label={t("serpMoversWindow")}
              className="print:hidden"
            >
              {MOVER_WINDOWS.map((window) => (
                <TabsOption
                  key={window}
                  id={moverWindowId(window)}
                  value={String(window)}
                >
                  {rangeLabel(`${window}d`, format)}
                </TabsOption>
              ))}
            </TabsList>
            <PrintRangeLabel preset={`${days}d`} />
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2">
        <Suspense fallback={<SerpMoversSkeleton />}>
          <SerpMoversList
            id={id}
            days={days}
            country={country}
            onWiden={() => {
              document.getElementById(moverWindowId(WIDEST_WINDOW))?.focus();
              void setDays(WIDEST_WINDOW);
            }}
          />
        </Suspense>
      </CardContent>
      <CardFooter>
        <span>
          {t("marketLastDays", {
            market: country
              ? formatCountryInLocale(country, locale)
              : t("allMarkets"),
            days,
          })}
        </span>
      </CardFooter>
    </Card>
  );
}
