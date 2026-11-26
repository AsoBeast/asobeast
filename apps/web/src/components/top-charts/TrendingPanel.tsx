"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { formatDayMonthInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { collectionLabel } from "./chart-params";
import { compareLabel } from "./movement";
import { EmptyState } from "@/components/ui/empty-state";

type TrendingList = keyof ChartTrending;

const LISTS: ReadonlyArray<{
  id: TrendingList;
  key: "climbers" | "entries" | "fallers" | "exits";
  shortKey?: "out";
  emptyKey: "noClimbers" | "noEntries" | "noFallers" | "noExits";
}> = [
  { id: "climbers", key: "climbers", emptyKey: "noClimbers" },
  { id: "entries", key: "entries", emptyKey: "noEntries" },
  { id: "fallers", key: "fallers", emptyKey: "noFallers" },
  { id: "exits", key: "exits", shortKey: "out", emptyKey: "noExits" },
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
  const t = useTranslations("topCharts");
  if (list === "entries") {
    return (
      <span className="text-muted-foreground">
        {t("trending.newAt", { position: mover.position ?? "—" })}
      </span>
    );
  }
  if (list === "exits") {
    return (
      <span className="text-muted-foreground">
        {t("trending.was", { position: mover.previous ?? "—" })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-3 whitespace-nowrap">
      <span aria-hidden className="numeric text-muted-foreground">
        <span>{`${mover.previous} → `}</span>
        <span className="font-medium text-foreground">{mover.position}</span>
      </span>
      <span className="sr-only">
        {t("trending.fromTo", {
          from: mover.previous ?? "—",
          to: mover.position ?? "—",
        })}
      </span>
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
    return <EmptyState title={`${empty} ${period}.`} />;
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
  const t = useTranslations("topCharts");
  const locale = useAppLocale();
  const period = compareLabel(page.compare, page.comparison, t, locale);

  return page.comparison ? (
    <Tabs defaultValue="climbers" className="@container/trending gap-2">
      <TabsList
        aria-label={t("trending.aria")}
        className="mx-2 w-auto self-stretch @xl/trending:self-start"
      >
        {LISTS.map(({ id, key, shortKey }) => (
          <TabsTrigger key={id} value={id} className="px-1.5">
            {shortKey ? (
              <>
                <span className="@max-sm/trending:sr-only">
                  {t(`trending.${key}`)}
                </span>
                <span aria-hidden className="@sm/trending:hidden">
                  {t(`trending.${shortKey}`)}
                </span>
              </>
            ) : (
              <span>{t(`trending.${key}`)}</span>
            )}
            <span className="numeric font-normal text-muted-foreground">
              {page.trending[id].length}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      {LISTS.map(({ id, emptyKey }) => (
        <TabsContent key={id} value={id}>
          <MoverList
            list={id}
            movers={page.trending[id]}
            period={period}
            empty={t(`trending.${emptyKey}`)}
          />
        </TabsContent>
      ))}
    </Tabs>
  ) : (
    <EmptyState title={t("trending.captureMore")} />
  );
}

function firstCompared(pages: readonly ChartPage[]): CategoryCollection {
  return (pages.find((page) => page.comparison) ?? pages[0]).chart.collection;
}

export function TrendingPanel({ pages }: { pages: readonly ChartPage[] }) {
  const t = useTranslations("topCharts");
  const locale = useAppLocale();
  const [kind, setKind] = useState(() => firstCompared(pages));
  const page =
    pages.find((candidate) => candidate.chart.collection === kind) ?? pages[0];
  const title = page.comparison
    ? t("trending.since", {
        date: formatDayMonthInLocale(page.comparison.date, locale),
      })
    : t("trending.title");

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
              <TabsList aria-label={t("trending.kind")}>
                {pages.map(({ chart }) => (
                  <TabsOption key={chart.collection} value={chart.collection}>
                    {collectionLabel(chart.collection, t)}
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
          <span>{t("trending.footer", { limit: CHART_TRENDING_LIMIT })}</span>
        </CardFooter>
      ) : null}
    </Card>
  );
}
