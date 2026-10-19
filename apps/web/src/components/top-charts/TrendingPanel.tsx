"use client";

import { useState } from "react";
import type {
  CategoryCollection,
  ChartMover,
  ChartPage,
  ChartTrending,
} from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeltaChip } from "@/components/ui/delta-chip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsOption,
  TabsTrigger,
} from "@/components/ui/tabs";
import { COLLECTION_LABELS } from "./chart-params";
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

function TrendingLists({ page }: { page: ChartPage }) {
  const period = compareLabel(page.compare, page.comparison);

  return page.comparison ? (
    <Tabs defaultValue="climbers">
      <TabsList
        aria-label="Trending list"
        className="w-full flex-wrap group-data-horizontal/tabs:h-auto"
      >
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
  );
}

function firstCompared(pages: readonly ChartPage[]): CategoryCollection {
  return (pages.find((page) => page.comparison) ?? pages[0]).chart.collection;
}

export function TrendingPanel({ pages }: { pages: readonly ChartPage[] }) {
  const [kind, setKind] = useState(() => firstCompared(pages));
  const page =
    pages.find((candidate) => candidate.chart.collection === kind) ?? pages[0];

  return (
    <Card>
      <CardHeader>
        <CardDescription>Trending</CardDescription>
        <CardTitle>{compareLabel(page.compare, page.comparison)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {pages.length > 1 ? (
          <Tabs
            value={page.chart.collection}
            onValueChange={(next) => setKind(next as CategoryCollection)}
          >
            <TabsList aria-label="Chart kind">
              {pages.map(({ chart }) => (
                <TabsOption key={chart.collection} value={chart.collection}>
                  {COLLECTION_LABELS[chart.collection]}
                </TabsOption>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
        <TrendingLists key={page.chart.collection} page={page} />
      </CardContent>
    </Card>
  );
}
