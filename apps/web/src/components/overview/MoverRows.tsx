import Link from "next/link";
import { formatRankPosition } from "@asobeast/shared";
import type { KeywordMover } from "@asobeast/shared";
import {
  moverChange,
  type MoverChange,
} from "@/components/dashboard/mover-change";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LIST_HEAD, LIST_ROW } from "./layout-classes";

const COLUMNS = "grid grid-cols-[minmax(0,1fr)_auto_4.5rem] gap-3 px-2";

const BAR_REACH_PERCENT = 60;

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

function changeLabel(change: MoverChange): string {
  if (change.kind === "new") return "started ranking";
  if (change.kind === "lost") return "dropped out of the results";
  return `${change.kind === "up" ? "up" : "down"} ${formatNumber(change.size)} in 7 days`;
}

function MoverLine({ href, mover }: { href: string; mover: KeywordMover }) {
  const change = moverChange(mover);
  return (
    <Link href={href} className={cn(COLUMNS, LIST_ROW)}>
      <span
        aria-hidden
        className="absolute inset-y-1 left-0 rounded-md bg-chart-tint print:hidden"
        style={{ width: `${Math.round(change.share * BAR_REACH_PERCENT)}%` }}
      />
      <span
        translate="no"
        className="relative truncate font-medium print:whitespace-normal"
      >
        {mover.text}
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
        <span className="sr-only">{changeLabel(change)}</span>
      </span>
    </Link>
  );
}

export function MoverRows({
  id,
  movers,
  empty,
}: {
  id: string;
  movers: KeywordMover[];
  empty: string;
}) {
  if (movers.length === 0) {
    return <p className="px-2 py-2 text-body text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      <div aria-hidden className={cn(COLUMNS, LIST_HEAD)}>
        <span>Keyword</span>
        <span className="text-right">Position</span>
        <span className="text-right">7d change</span>
      </div>
      <ul className="flex flex-col">
        {movers.map((mover) => (
          <li key={mover.keywordId}>
            <MoverLine
              href={`/apps/${id}/rankings?keywords=${mover.keywordId}`}
              mover={mover}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
