import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { formatRankPosition } from "@asobeast/shared";
import type { KeywordMover } from "@asobeast/shared";
import { LIST_HEAD, LIST_ROW } from "@/components/layout/panel-classes";
import { DirectionArrow } from "@/components/ui/delta-chip";
import { formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";
import {
  moverChange,
  type MoverChange,
  type MoverPeriod,
} from "./mover-change";
import { EmptyState } from "@/components/ui/empty-state";

export const MOVER_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_auto_4.5rem] gap-3 px-2";

const BAR_REACH_PERCENT = 60;

const CHANGE_TONE: Record<MoverChange["kind"], string> = {
  up: "text-signal-up",
  new: "text-signal-up",
  down: "text-signal-down",
  lost: "text-signal-down",
};

const changeWay = (change: MoverChange): "up" | "down" =>
  change.kind === "up" || change.kind === "new" ? "up" : "down";

function MoverLine({
  mover,
  href,
  period,
  children,
}: {
  mover: KeywordMover;
  href: string;
  period: MoverPeriod;
  children: ReactNode;
}) {
  const t = useTranslations("rankings");
  const locale = useAppLocale();
  const change = moverChange(mover);
  const changeText =
    change.kind === "new"
      ? t("new")
      : change.kind === "lost"
        ? t("lost")
        : formatNumberInLocale(change.size, locale);
  const changeLabel =
    change.kind === "new"
      ? t("startedRanking")
      : change.kind === "lost"
        ? t("droppedOut")
        : t("changeAria", {
            direction: t(change.kind),
            count: formatNumberInLocale(change.size, locale),
            period: period.within,
          });
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
          <span>{changeText}</span>
        </span>
        <span className="sr-only">{changeLabel}</span>
      </span>
    </Link>
  );
}

export function MoverList<Mover extends KeywordMover>({
  movers,
  period,
  empty,
  changeHeading,
  hrefOf,
  lead,
}: {
  movers: Mover[];
  period: MoverPeriod;
  empty: string;
  changeHeading?: string;
  hrefOf: (mover: Mover) => string;
  lead: (mover: Mover) => ReactNode;
}) {
  const t = useTranslations("rankings");
  if (movers.length === 0) {
    return <EmptyState title={empty} />;
  }
  return (
    <div className="flex flex-col gap-1">
      <div aria-hidden className={cn(MOVER_COLUMNS, LIST_HEAD)}>
        <span>{t("keyword")}</span>
        <span className="text-right">{t("position")}</span>
        <span className="text-right">{changeHeading ?? t("change")}</span>
      </div>
      <ul className="flex flex-col">
        {movers.map((mover) => {
          const href = hrefOf(mover);
          return (
            <li key={href}>
              <MoverLine mover={mover} href={href} period={period}>
                {lead(mover)}
              </MoverLine>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
