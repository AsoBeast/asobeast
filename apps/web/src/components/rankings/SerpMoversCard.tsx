"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { SerpMoverItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { TrackButton } from "@/components/competitors/TrackButton";
import { formatDate } from "@/lib/format";
import { serpMoversOptions } from "@/lib/queries";
import { MOVER_WINDOWS } from "@/lib/ranges";
import { moverDaysParser } from "@/lib/search-params";

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

function SerpMoversList({ id, days }: { id: string; days: number }) {
  const { data } = useSuspenseQuery(serpMoversOptions(id, days));

  if (data.items.length === 0) {
    return (
      <EmptyState
        title={`No new entrants in the last ${days} days`}
        body="Nobody broke into the top 10 for your tracked keywords in this window. Widen it to look further back."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groupByDay(data.items).map(([date, items]) => (
        <div key={date} className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {formatDate(date)}
          </p>
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li
                key={`${item.date}-${item.keywordId}-${item.storeAppId}`}
                className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                    {item.appId === id ? <Badge>You</Badge> : null}
                    {item.isCompetitor ? (
                      <Badge variant="secondary">Competitor</Badge>
                    ) : null}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    entered the top 10 for{" "}
                    <span className="italic">{item.text}</span> at #
                    {item.position}
                  </span>
                </div>
                {item.appId === null ? (
                  <TrackButton
                    id={id}
                    storeAppId={item.storeAppId}
                    title={item.title}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SerpMoversSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SerpMoversCard({ id }: { id: string }) {
  const [days, setDays] = useQueryState("movers", moverDaysParser);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>SERP movers</CardDescription>
          <CardTitle>New entrants in your keywords’ top 10</CardTitle>
        </div>
        <Tabs
          value={String(days)}
          onValueChange={(next) => void setDays(Number(next) as typeof days)}
        >
          <TabsList aria-label="SERP movers window">
            {MOVER_WINDOWS.map((window) => (
              <TabsTrigger key={window} value={String(window)}>
                {window}d
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<SerpMoversSkeleton />}>
          <SerpMoversList id={id} days={days} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
