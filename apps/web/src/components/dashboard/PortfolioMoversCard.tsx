"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { PortfolioRangeChange } from "@asobeast/shared";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { useQueryState } from "nuqs";
import { portfolioOptions } from "@/lib/queries";
import {
  MOVER_VIEWS,
  moverViewParser,
  type MoverView,
} from "@/lib/search-params";
import { byMagnitude } from "./mover-change";
import { quietSentence } from "./movement-sentence";
import { useRangeHistory } from "./use-range-history";
import { MoverBreakdown } from "./MoverBreakdown";
import { PANEL_ACTION, PANEL_HEADER } from "./layout-classes";

const ALL_MOVERS = 8;

const MOVER_LABELS: Record<MoverView, string> = {
  all: "All",
  up: "Climbers",
  down: "Fallers",
};

const EMPTY: Record<MoverView, (days: number) => string> = {
  all: (days) => `No movement in the last ${days} days.`,
  up: (days) => `No keyword climbed in the last ${days} days.`,
  down: (days) => `No keyword fell in the last ${days} days.`,
};

function quietOf(change: PortfolioRangeChange, days: number): string | null {
  const { up, down } = change.movement;
  return up + down > 0 ? null : quietSentence(change.compared, days);
}

export function PortfolioMoversCard() {
  const { days, history } = useRangeHistory();
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const apps = new Map(portfolio.apps.map((app) => [app.id, app]));
  const quiet = quietOf(history.change, days);
  const [view, setView] = useQueryState("movers", moverViewParser);
  const { up, down } = history.change.movers;
  const all = byMagnitude([...up, ...down]).slice(0, ALL_MOVERS);

  const shown = { all, up, down }[view];

  return (
    <Card className="h-full">
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>Keyword movers</h2>
        </CardTitle>
        {quiet ? null : (
          <CardAction className={PANEL_ACTION}>
            <Tabs
              value={view}
              onValueChange={(next) =>
                void setView(moverViewParser.parse(next))
              }
            >
              <TabsList aria-label="Movers shown">
                {MOVER_VIEWS.map((value) => (
                  <TabsOption key={value} value={value}>
                    {MOVER_LABELS[value]}
                  </TabsOption>
                ))}
              </TabsList>
            </Tabs>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex-1 px-2">
        {quiet ? (
          <p className="px-2 text-body text-muted-foreground">{quiet}</p>
        ) : (
          <MoverBreakdown
            movers={shown}
            apps={apps}
            days={days}
            empty={EMPTY[view](days)}
          />
        )}
      </CardContent>
      <CardFooter>{`Largest position changes in the last ${days} days`}</CardFooter>
    </Card>
  );
}
