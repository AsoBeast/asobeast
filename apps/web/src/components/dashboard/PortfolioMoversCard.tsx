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
import { moverViewParser, type MoverView } from "@/lib/search-params";
import { byMagnitude } from "./mover-change";
import { hasWeekOfHistory } from "./movement-sentence";
import { MoverBreakdown } from "./MoverBreakdown";

const ALL_MOVERS = 8;

const MOVER_VIEWS: Array<[MoverView, string]> = [
  ["all", "All"],
  ["up", "Climbers"],
  ["down", "Fallers"],
];

const EMPTY: Record<MoverView, string> = {
  all: "No movement this week.",
  up: "No keyword climbed this week.",
  down: "No keyword fell this week.",
};

function quietSentence(insights: PortfolioInsights): string | null {
  const { up, down } = insights.totals.movement;
  if (up + down > 0) return null;
  return hasWeekOfHistory(insights)
    ? "No keyword moved this week."
    : "Movement appears after a week of daily runs.";
}

export function PortfolioMoversCard() {
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const apps = new Map(portfolio.apps.map((app) => [app.id, app]));
  const quiet = quietSentence(insights);
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
                {MOVER_VIEWS.map(([value, label]) => (
                  <TabsOption key={value} value={value}>
                    {label}
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
