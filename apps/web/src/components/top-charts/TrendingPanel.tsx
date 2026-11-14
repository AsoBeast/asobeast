"use client";

import { useState } from "react";
import type {
  CategoryCollection,
  ChartMover,
  ChartPage,
  ChartTrending,
} from "@asobeast/shared";
import { CHART_TRENDING_LIMIT } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { PANEL_ACTION, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
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
import { formatDayMonth } from "@/lib/format";
import { COLLECTION_LABELS } from "./chart-params";
import { compareLabel } from "./movement";

type TrendingList = keyof ChartTrending;

const LISTS: ReadonlyArray<{
  id: TrendingList;
  label: string;
  short?: string;
  empty: string;
}> = [
  { id: "climbers", label: "Climbers", empty: "No climbers" },
  { id: "entries", label: "New", empty: "No new entries" },
  { id: "fallers", label: "Fallers", empty: "No fallers" },
  {
    id: "exits",
    label: "Dropped out",
    short: "Out",
    empty: "Nothing dropped out",
  },
];

const BAR_REACH_PERCENT = 60;
const BAR_FULL_MOVE = 20;

const ROW =
  "relative grid h-10 grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 text-dense sm:h-9";

function barWidth(delta: number | null): number {
  const share = Math.min(Math.abs(delta ?? 0), BAR_FULL_MOVE) / BAR_FULL_MOVE;
  return Math.round(share * BAR_REACH_PERCENT);
}

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
    return (
      <span className="text-muted-foreground">{`New at #${mover.position}`}</span>
    );
  }
  if (list === "exits") {
    return (
      <span className="text-muted-foreground">{`Was #${mover.previous}`}</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-3 whitespace-nowrap">
      <span aria-hidden className="numeric text-muted-foreground">
        <span>{`${mover.previous} → `}</span>
        <span className="font-medium text-foreground">{mover.position}</span>
      </span>
      <span className="sr-only">{`from #${mover.previous} to #${mover.position}`}</span>
      <DeltaChip
        value={mover.delta}
        period={period}
        className="min-w-8 justify-end text-label"
      />
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
      <p className="px-2 py-2 text-body text-muted-foreground">{`${empty} ${period}.`}</p>
    );
  }
  return (
    <ul className="flex flex-col">
      {movers.map((mover) => (
        <li key={mover.storeAppId} className={ROW}>
          <span
            aria-hidden
            className="absolute inset-y-1 left-0 rounded-md bg-chart-tint"
            style={{ width: `${barWidth(mover.delta)}%` }}
          />
          <span className="relative">
            <AppIcon src={mover.iconUrl} size={16} />
          </span>
          <span className="relative truncate font-medium" translate="no">
            <bdi>{mover.title}</bdi>
          </span>
          <span className="numeric relative">
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
    <Tabs defaultValue="climbers" className="@container/trending gap-2">
      <TabsList
        aria-label="Trending list"
        className="mx-2 w-auto self-stretch @xl/trending:self-start"
      >
        {LISTS.map(({ id, label, short }) => (
          <TabsTrigger key={id} value={id} className="px-1.5">
            {short ? (
              <>
                <span className="@max-sm/trending:sr-only">{label}</span>
                <span aria-hidden className="@sm/trending:hidden">
                  {short}
                </span>
              </>
            ) : (
              <span>{label}</span>
            )}
            <span className="numeric font-normal text-muted-foreground">
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
    <p className="px-2 py-2 text-body text-muted-foreground">
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
  const title = page.comparison
    ? `Trending since ${formatDayMonth(page.comparison.date)}`
    : "Trending";

  return (
    <Card className="gap-3">
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>{title}</h2>
        </CardTitle>
        {pages.length > 1 ? (
          <CardAction className={PANEL_ACTION}>
            <Tabs
              value={page.chart.collection}
              onValueChange={(next) => {
                const chosen = pages.find(
                  ({ chart }) => chart.collection === next,
                );
                if (chosen) setKind(chosen.chart.collection);
              }}
            >
              <TabsList aria-label="Chart kind">
                {pages.map(({ chart }) => (
                  <TabsOption key={chart.collection} value={chart.collection}>
                    {COLLECTION_LABELS[chart.collection]}
                  </TabsOption>
                ))}
              </TabsList>
            </Tabs>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="px-2">
        <TrendingLists key={page.chart.collection} page={page} />
      </CardContent>
      {page.comparison ? (
        <CardFooter>
          <span>{`Up to ${CHART_TRENDING_LIMIT} per list, from every captured place.`}</span>
        </CardFooter>
      ) : null}
    </Card>
  );
}
