"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type {
  PortfolioApp,
  PortfolioKeywordMover,
  PortfolioRangeChange,
} from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { MoversPanel } from "@/components/rankings/MoversPanel";
import { portfolioOptions } from "@/lib/queries";
import { quietSentence } from "./movement-sentence";
import { useRangeHistory } from "./use-range-history";

const rankingsHref = (mover: PortfolioKeywordMover) =>
  `/apps/${mover.appId}/rankings?keywords=${mover.keywordId}`;

function quietOf(change: PortfolioRangeChange, days: number): string | null {
  const { up, down } = change.movement;
  return up + down > 0 ? null : quietSentence(change.compared, days);
}

function MoverLead({
  mover,
  app,
}: {
  mover: PortfolioKeywordMover;
  app: PortfolioApp | undefined;
}) {
  return (
    <>
      <AppIcon src={app?.iconUrl ?? null} size={16} />
      <span translate="no" className="truncate font-medium">
        {mover.text}
      </span>
      <span className="sr-only">{` ${app?.name ?? "Unknown app"}`}</span>
      <span className="shrink-0 text-label text-muted-foreground">
        {mover.country.toUpperCase()}
      </span>
    </>
  );
}

export function PortfolioMoversCard() {
  const { days, history } = useRangeHistory();
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const apps = new Map(portfolio.apps.map((app) => [app.id, app]));

  return (
    <MoversPanel
      movers={history.change.movers}
      days={days}
      quiet={quietOf(history.change, days)}
      hrefOf={rankingsHref}
      lead={(mover) => <MoverLead mover={mover} app={apps.get(mover.appId)} />}
      footer={`Largest position changes in the last ${days} days`}
    />
  );
}
