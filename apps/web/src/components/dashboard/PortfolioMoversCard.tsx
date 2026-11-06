"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { PortfolioInsights } from "@asobeast/shared";
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
import { portfolioInsightsOptions, portfolioOptions } from "@/lib/queries";
import {
  MOVER_VIEWS,
  moverViewParser,
  type MoverView,
} from "@/lib/search-params";
import { byMagnitude } from "./mover-change";
import { hasWeekOfHistory, quietSentence } from "./movement-sentence";
import { MoverBreakdown } from "./MoverBreakdown";

const ALL_MOVERS = 8;

const MOVER_LABELS: Record<MoverView, string> = {
  all: "All",
  up: "Climbers",
  down: "Fallers",
};

const EMPTY: Record<MoverView, string> = {
  all: "No movement this week.",
  up: "No keyword climbed this week.",
  down: "No keyword fell this week.",
};

function quietOf(insights: PortfolioInsights): string | null {
  const { up, down } = insights.totals.movement;
  return up + down > 0 ? null : quietSentence(hasWeekOfHistory(insights));
}

export function PortfolioMoversCard() {
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const apps = new Map(portfolio.apps.map((app) => [app.id, app]));
  const quiet = quietOf(insights);
  const [view, setView] = useQueryState("movers", moverViewParser);
  const { up, down } = insights.movers;
  const all = byMagnitude([...up, ...down]).slice(0, ALL_MOVERS);

  const shown = { all, up, down }[view];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle asChild>
          <h2>Keyword movers</h2>
        </CardTitle>
        {quiet ? null : (
          <CardAction>
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
          <MoverBreakdown movers={shown} apps={apps} empty={EMPTY[view]} />
        )}
      </CardContent>
      <CardFooter>Largest position changes in the last 7 days</CardFooter>
    </Card>
  );
}
