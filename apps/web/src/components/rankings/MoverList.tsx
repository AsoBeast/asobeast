import type { ReactNode } from "react";
import Link from "next/link";
import { formatRankPosition } from "@asobeast/shared";
import type { KeywordMover } from "@asobeast/shared";
import { LIST_HEAD, LIST_ROW } from "@/components/layout/panel-classes";
import { DirectionArrow } from "@/components/ui/delta-chip";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { moverChange, type MoverChange } from "./mover-change";

export const MOVER_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_auto_4.5rem] gap-3 px-2";

const BAR_REACH_PERCENT = 60;

const CHANGE_TONE: Record<MoverChange["kind"], string> = {
  up: "text-signal-up",
  new: "text-signal-up",
  down: "text-signal-down",
  lost: "text-signal-down",
};

function changeText(change: MoverChange): string {
  if (change.kind === "new") return "new";
  if (change.kind === "lost") return "lost";
  return formatNumber(change.size);
}

const changeWay = (change: MoverChange): "up" | "down" =>
  change.kind === "up" || change.kind === "new" ? "up" : "down";

function changeLabel(change: MoverChange, days: number): string {
  if (change.kind === "new") return "started ranking";
  if (change.kind === "lost") return "dropped out of the results";
  return `${change.kind === "up" ? "up" : "down"} ${formatNumber(change.size)} in ${days} days`;
}

function MoverLine({
  mover,
  href,
  days,
  children,
}: {
  mover: KeywordMover;
  href: string;
  days: number;
  children: ReactNode;
}) {
  const change = moverChange(mover);
  return (
    <Link href={href} className={cn(MOVER_COLUMNS, LIST_ROW)}>
      <span
        aria-hidden
        data-slot="mover-bar"
        className="absolute inset-y-1 left-0 rounded-md bg-chart-tint print:hidden"
        style={{ width: `${Math.round(change.share * BAR_REACH_PERCENT)}%` }}
      />
      <span className="relative flex min-w-0 items-center gap-2">
        {children}
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
        <span aria-hidden className="inline-flex items-center gap-0.5">
          <DirectionArrow way={changeWay(change)} />
          <span>{changeText(change)}</span>
        </span>
        <span className="sr-only">{changeLabel(change, days)}</span>
      </span>
    </Link>
  );
}

export function MoverList<Mover extends KeywordMover>({
  movers,
  days,
  empty,
  changeHeading = "Change",
  hrefOf,
  lead,
}: {
  movers: Mover[];
  days: number;
  empty: string;
  changeHeading?: string;
  hrefOf: (mover: Mover) => string;
  lead: (mover: Mover) => ReactNode;
}) {
  if (movers.length === 0) {
    return <p className="px-2 py-2 text-body text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      <div aria-hidden className={cn(MOVER_COLUMNS, LIST_HEAD)}>
        <span>Keyword</span>
        <span className="text-right">Position</span>
        <span className="text-right">{changeHeading}</span>
      </div>
      <ul className="flex flex-col">
        {movers.map((mover) => {
          const href = hrefOf(mover);
          return (
            <li key={href}>
              <MoverLine mover={mover} href={href} days={days}>
                {lead(mover)}
              </MoverLine>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
