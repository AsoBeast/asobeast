"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type {
  PortfolioApp,
  PortfolioKeywordMover,
  PortfolioRangeChange,
} from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import {
  daysPeriod,
  LAST_RUN,
  type MoverPeriod,
} from "@/components/rankings/mover-change";
import { ALL_MOVERS, MoversPanel } from "@/components/rankings/MoversPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import { portfolioOptions } from "@/lib/queries";
import { moverSpanParser, type MoverSpan } from "@/lib/search-params";
import { quietSentence } from "./movement-sentence";
import { useRangeHistory } from "./use-range-history";

const rankingsHref = (mover: PortfolioKeywordMover) =>
  `/apps/${mover.appId}/rankings?keywords=${mover.keywordId}`;

const QUIET_RUN = "No keyword moved in the last run.";

function MoverLead({
  mover,
  app,
}: {
  mover: PortfolioKeywordMover;
  app: PortfolioApp | undefined;
}) {
  const mark = `${mover.country.toUpperCase()} · ${app?.name ?? "Unknown app"}`;
  return (
    <>
      <AppIcon src={app?.iconUrl ?? null} size={16} />
      <span
        translate="no"
        className="max-w-[65%] shrink-0 truncate font-medium"
      >
        {mover.text}
      </span>
      <span
        title={mark}
        className="min-w-0 truncate text-label text-muted-foreground"
      >
        {mark}
      </span>
    </>
  );
}

function SpanSelect({
  span,
  days,
  onChange,
}: {
  span: MoverSpan;
  days: number;
  onChange: (next: MoverSpan) => void;
}) {
  const labels: Record<MoverSpan, string> = {
    run: "Last run",
    range: `Last ${days} days`,
  };
  return (
    <Select
      value={span}
      onValueChange={(next) => onChange(moverSpanParser.parse(next) ?? "run")}
    >
      <SelectTrigger size="sm" aria-label={`Movers period, ${labels[span]}`}>
        <SelectValue>{labels[span]}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="run">{labels.run}</SelectItem>
        <SelectItem value="range">{labels.range}</SelectItem>
      </SelectContent>
    </Select>
  );
}

const quietOf = (
  change: PortfolioRangeChange,
  daily: boolean,
  days: number,
): string => (daily ? QUIET_RUN : quietSentence(change.compared, days));

function footerOf(change: PortfolioRangeChange, period: MoverPeriod): string {
  const moved = change.movement.up + change.movement.down;
  return moved > ALL_MOVERS
    ? `The largest of ${formatNumber(moved)} position changes ${period.span}`
    : `Position changes ${period.span}, largest first`;
}

export function PortfolioMoversCard() {
  const { days, history } = useRangeHistory();
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const [span, setSpan] = useQueryState("span", moverSpanParser);
  const apps = new Map(portfolio.apps.map((app) => [app.id, app]));

  const { lastRun } = history;
  const daily = span === "run" && lastRun?.compared === true;
  const change = daily ? lastRun : history.change;
  const period = daily ? LAST_RUN : daysPeriod(days);
  const { up, down } = change.movement;
  const quiet = up + down > 0 ? null : quietOf(change, daily, days);

  return (
    <MoversPanel
      movers={change.movers}
      period={period}
      quiet={quiet}
      counts={{ all: up + down, up, down }}
      control={
        lastRun?.compared ? (
          <SpanSelect
            span={span}
            days={days}
            onChange={(next) => void setSpan(next)}
          />
        ) : null
      }
      hrefOf={rankingsHref}
      lead={(mover) => <MoverLead mover={mover} app={apps.get(mover.appId)} />}
      footer={quiet === null ? footerOf(change, period) : null}
    />
  );
}
