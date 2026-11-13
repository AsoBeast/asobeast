"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
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
import { formatCountry, formatDate, formatNumber } from "@/lib/format";
import { serpMoversOptions } from "@/lib/queries";
import { MOVER_WINDOWS, type MoverWindow } from "@/lib/ranges";
import { countryParser, moverDaysParser } from "@/lib/search-params";
import { PrintRangeLabel } from "./RangePicker";

const WIDEST_WINDOW = MOVER_WINDOWS[MOVER_WINDOWS.length - 1];

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

function ownership(item: SerpMoverItem, id: string): string | null {
  if (item.appId === id) return "You";
  return item.isCompetitor ? "Competitor" : null;
}

function EntrantRow({ item, id }: { item: SerpMoverItem; id: string }) {
  const owner = ownership(item, id);
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
  const { data } = useSuspenseQuery(serpMoversOptions(id, days, country));
  const market = country ? formatCountry(country) : null;

  if (data.items.length === 0) {
    return (
      <EmptyState
        title={`No new entrants in the last ${days} days`}
        body={
          market
            ? `Nobody broke into the top 10 for your tracked keywords in ${market} in this window.`
            : "Nobody broke into the top 10 for your tracked keywords in this window."
        }
        action={
          days === WIDEST_WINDOW ? null : (
            <Button
              variant="outline"
              size="sm"
              className="print:hidden"
              onClick={onWiden}
            >
              {`Look back ${WIDEST_WINDOW} days`}
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {groupByDay(data.items).map(([date, items]) => (
        <section key={date} aria-label={formatDate(date)}>
          <h3 className="flex h-9 items-center gap-2 px-2 text-label">
            <span>{formatDate(date)}</span>
            <span className="numeric font-normal text-faint-foreground">
              {formatNumber(items.length)}
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
  const [days, setDays] = useQueryState("movers", moverDaysParser);
  const [country] = useQueryState("country", countryParser);

  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>New in your top 10</h2>
        </CardTitle>
        <CardAction className={PANEL_ACTION}>
          <Tabs
            value={String(days)}
            onValueChange={(next) => void setDays(Number(next) as typeof days)}
          >
            <TabsList aria-label="SERP movers window" className="print:hidden">
              {MOVER_WINDOWS.map((window) => (
                <TabsOption key={window} value={String(window)}>
                  {`${window}d`}
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
            onWiden={() => void setDays(WIDEST_WINDOW)}
          />
        </Suspense>
      </CardContent>
      <CardFooter>
        <span>
          {`${country ? formatCountry(country) : "All markets"} · last ${days} days`}
        </span>
      </CardFooter>
    </Card>
  );
}
