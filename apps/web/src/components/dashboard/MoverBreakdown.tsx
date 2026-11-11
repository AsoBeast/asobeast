import type { PortfolioApp, PortfolioKeywordMover } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { MoverList } from "./MoverList";

const rankingsHref = (mover: PortfolioKeywordMover) =>
  `/apps/${mover.appId}/rankings?keywords=${mover.keywordId}`;

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

export function MoverBreakdown({
  movers,
  apps,
  days,
  empty,
}: {
  movers: PortfolioKeywordMover[];
  apps: ReadonlyMap<string, PortfolioApp>;
  days: number;
  empty: string;
}) {
  return (
    <MoverList
      movers={movers}
      days={days}
      empty={empty}
      hrefOf={rankingsHref}
      lead={(mover) => <MoverLead mover={mover} app={apps.get(mover.appId)} />}
    />
  );
}
