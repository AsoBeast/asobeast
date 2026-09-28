"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type {
  PortfolioInsights,
  PortfolioKeywordMover,
} from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { MoverList } from "@/components/rankings/MoverRow";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { portfolioInsightsOptions, portfolioOptions } from "@/lib/queries";

const rankingsHref = (mover: PortfolioKeywordMover) =>
  `/apps/${mover.appId}/rankings?keywords=${mover.keywordId}`;

function quietSentence(insights: PortfolioInsights): string | null {
  const { up, down } = insights.totals.movement;
  if (up + down > 0) return null;
  const ranked = insights.apps.some(
    (app) => app.rankDistribution.top50 + app.rankDistribution.beyond > 0,
  );
  return ranked
    ? "No keyword moved this week."
    : "Movement appears after two daily runs.";
}

export function PortfolioMoversCard() {
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const apps = new Map(portfolio.apps.map((app) => [app.id, app]));
  const quiet = quietSentence(insights);

  const moverContext = (mover: PortfolioKeywordMover) => {
    const app = apps.get(mover.appId);
    return (
      <>
        <AppIcon
          src={app?.iconUrl ?? null}
          name={app?.name ?? null}
          size={16}
        />
        <span className="sr-only">{app?.name ?? "Unknown app"}</span>
        <span className="text-caption text-muted-foreground">
          {mover.country.toUpperCase()}
        </span>
      </>
    );
  };

  const list = (movers: PortfolioKeywordMover[], title?: string) => (
    <MoverList
      title={title}
      movers={movers}
      renderHref={rankingsHref}
      renderContext={moverContext}
      rowClassName="min-h-10"
    />
  );

  return (
    <Card className="@container/movers">
      <CardHeader>
        <CardTitle asChild>
          <h2>Keyword movers</h2>
        </CardTitle>
        <CardDescription>
          Largest position changes in the last 7 days, across every app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {quiet ? (
          <p className="text-sm text-muted-foreground">{quiet}</p>
        ) : (
          <>
            <div className="hidden gap-6 @md/movers:grid @md/movers:grid-cols-2">
              {list(insights.movers.up, "Climbers")}
              {list(insights.movers.down, "Fallers")}
            </div>
            <Tabs defaultValue="up" className="@md/movers:hidden">
              <TabsList>
                <TabsTrigger value="up">Climbers</TabsTrigger>
                <TabsTrigger value="down">Fallers</TabsTrigger>
              </TabsList>
              <TabsContent value="up">{list(insights.movers.up)}</TabsContent>
              <TabsContent value="down">
                {list(insights.movers.down)}
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}
