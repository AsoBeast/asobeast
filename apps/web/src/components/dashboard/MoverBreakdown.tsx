import Link from "next/link";
import { formatRankPosition } from "@asobeast/shared";
import type { PortfolioApp, PortfolioKeywordMover } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { moverChange, type MoverChange } from "./mover-change";

const CHANGE_TONE: Record<MoverChange["kind"], string> = {
  up: "text-signal-up",
  new: "text-signal-up",
  down: "text-signal-down",
  lost: "text-signal-down",
};

function changeText(change: MoverChange): string {
  if (change.kind === "new") return "▲ new";
  if (change.kind === "lost") return "▼ lost";
  return `${change.kind === "up" ? "▲" : "▼"} ${formatNumber(change.size)}`;
}

function changeLabel(change: MoverChange, days: number): string {
  if (change.kind === "new") return "started ranking";
  if (change.kind === "lost") return "dropped out of the results";
  return `${change.kind === "up" ? "up" : "down"} ${formatNumber(change.size)} in ${days} days`;
}

const rankingsHref = (mover: PortfolioKeywordMover) =>
  `/apps/${mover.appId}/rankings?keywords=${mover.keywordId}`;

function MoverLine({
  mover,
  app,
  days,
}: {
  mover: PortfolioKeywordMover;
  app: PortfolioApp | undefined;
  days: number;
}) {
  const change = moverChange(mover);
  return (
    <Link
      href={rankingsHref(mover)}
      className="group/mover relative grid h-10 grid-cols-[minmax(0,1fr)_auto_4.5rem] items-center gap-3 rounded-md px-2 text-dense outline-none sm:h-9 transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        data-slot="mover-bar"
        className="absolute inset-y-1 left-0 rounded-md bg-chart-tint"
        style={{ width: `${Math.round(change.share * 60)}%` }}
      />
      <span className="relative flex min-w-0 items-center gap-2">
        <AppIcon src={app?.iconUrl ?? null} size={16} />
        <span translate="no" className="truncate font-medium">
          {mover.text}
        </span>
        <span className="sr-only">{` ${app?.name ?? "Unknown app"}`}</span>
        <span className="shrink-0 text-label text-muted-foreground">
          {mover.country.toUpperCase()}
        </span>
      </span>
      <span className="numeric relative text-right whitespace-nowrap text-muted-foreground">
        <span>{`${formatRankPosition(mover.from, mover.fromDepth)} → `}</span>
        <span className="font-medium text-foreground">
          {formatRankPosition(mover.to, mover.toDepth)}
        </span>
      </span>
      <span
        className={cn(
          "numeric relative text-right font-medium whitespace-nowrap",
          CHANGE_TONE[change.kind],
        )}
      >
        <span aria-hidden>{changeText(change)}</span>
        <span className="sr-only">{changeLabel(change, days)}</span>
      </span>
    </Link>
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
  if (movers.length === 0) {
    return <p className="px-2 py-2 text-body text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      <div
        aria-hidden
        className="grid grid-cols-[minmax(0,1fr)_auto_4.5rem] gap-3 px-2 text-label text-faint-foreground"
      >
        <span>Keyword</span>
        <span className="text-right">Position</span>
        <span className="text-right">Change</span>
      </div>
      <ul className="flex flex-col">
        {movers.map((mover) => (
          <li key={rankingsHref(mover)}>
            <MoverLine mover={mover} app={apps.get(mover.appId)} days={days} />
          </li>
        ))}
      </ul>
    </div>
  );
}
