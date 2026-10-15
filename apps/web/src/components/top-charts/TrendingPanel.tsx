"use client";

import type { ChartMover, ChartPage, ChartTrending } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeltaChip } from "@/components/ui/delta-chip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { compareLabel } from "./movement";

type TrendingList = keyof ChartTrending;

const LISTS: ReadonlyArray<{ id: TrendingList; label: string; empty: string }> =
  [
    { id: "climbers", label: "Climbers", empty: "No climbers" },
    { id: "entries", label: "New", empty: "No new entries" },
    { id: "fallers", label: "Fallers", empty: "No fallers" },
    { id: "exits", label: "Dropped out", empty: "Nothing dropped out" },
  ];

function Place({
  list,
  mover,
  period,
}: {
  list: TrendingList;
  mover: ChartMover;
  period: string;
}) {
  if (list === "entries") {
    return <span>New at #{mover.position}</span>;
  }
  if (list === "exits") {
    return <span>Was #{mover.previous}</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <DeltaChip value={mover.delta} period={period} />
      <span className="text-caption text-muted-foreground">
        from #{mover.previous}
      </span>
    </span>
  );
}

function MoverList({
  list,
  movers,
  period,
  empty,
}: {
  list: TrendingList;
  movers: ChartMover[];
  period: string;
  empty: string;
}) {
  if (movers.length === 0) {
    return (
      <p className="text-body text-muted-foreground">
        {empty} {period}.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y">
      {movers.map((mover) => (
        <li
          key={mover.storeAppId}
          className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
        >
          <AppIcon src={mover.iconUrl} name={mover.title} size={28} />
          <span className="min-w-0 flex-1 truncate" translate="no">
            {mover.title}
          </span>
          <span className="text-body text-muted-foreground">
            <Place list={list} mover={mover} period={period} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TrendingPanel({ page }: { page: ChartPage }) {
  const period = compareLabel(page.compare, page.comparison);

  return (
    <Card>
      <CardHeader>
        <CardDescription>Trending</CardDescription>
        <CardTitle>{period}</CardTitle>
      </CardHeader>
      <CardContent>
        {page.comparison ? (
          <Tabs defaultValue="climbers">
            <TabsList aria-label="Trending list" className="w-full">
              {LISTS.map(({ id, label }) => (
                <TabsTrigger key={id} value={id}>
                  {label}
                  <span className="numeric font-mono">
                    {page.trending[id].length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            {LISTS.map(({ id, empty }) => (
              <TabsContent key={id} value={id}>
                <MoverList
                  list={id}
                  movers={page.trending[id]}
                  period={period}
                  empty={empty}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <p className="text-body text-muted-foreground">
            Capture more days to see movement.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
