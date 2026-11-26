"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import type {
  PortfolioApp,
  PortfolioKeywordMover,
  PortfolioRangeChange,
} from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { daysPeriod, LAST_RUN } from "@/components/rankings/mover-change";
import { ALL_MOVERS, MoversPanel } from "@/components/rankings/MoversPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MessageTranslator } from "@/i18n/translator";
import { portfolioOptions } from "@/lib/queries";
import { moverSpanParser, type MoverSpan } from "@/lib/search-params";
import { quietSentence } from "./movement-sentence";
import { useRangeHistory } from "./use-range-history";

const rankingsHref = (mover: PortfolioKeywordMover) =>
  `/apps/${mover.appId}/rankings?keywords=${mover.keywordId}`;

const QUIET_RUN = "quietRun";

function MoverLead({
  mover,
  app,
}: {
  mover: PortfolioKeywordMover;
  app: PortfolioApp | undefined;
}) {
  const t = useTranslations("dashboard");
  const mark = `${mover.country.toUpperCase()} · ${app?.name ?? t("actions.unknownApp")}`;
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
  const t = useTranslations("dashboard");
  const labels: Record<MoverSpan, string> = {
    run: t("movers.lastRun"),
    range: t("range.label", { days }),
  };
  return (
    <Select
      value={span}
      onValueChange={(next) => onChange(moverSpanParser.parse(next) ?? "run")}
    >
      <SelectTrigger
        size="sm"
        aria-label={t("movers.periodAria", { period: labels[span] })}
      >
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
  t: MessageTranslator,
): string => (daily ? t(QUIET_RUN) : quietSentence(change.compared, days, t));

function footerOf(
  change: PortfolioRangeChange,
  period: string,
  t: MessageTranslator,
): string {
  const moved = change.movement.up + change.movement.down;
  return moved > ALL_MOVERS
    ? t("movers.largest", { count: moved, period })
    : t("movers.all", { period });
}

export function PortfolioMoversCard() {
  const t = useTranslations("dashboard");
  const { days, history } = useRangeHistory();
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const [span, setSpan] = useQueryState("span", moverSpanParser);
  const apps = new Map(portfolio.apps.map((app) => [app.id, app]));

  const { lastRun } = history;
  const daily = span === "run" && lastRun?.compared === true;
  const change = daily ? lastRun : history.change;
  const period = daily ? LAST_RUN : daysPeriod(days);
  const periodText = daily
    ? t("movers.periodRun")
    : t("movers.periodRange", { days });
  const { up, down } = change.movement;
  const quiet = up + down > 0 ? null : quietOf(change, daily, days, t);

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
      footer={quiet === null ? footerOf(change, periodText, t) : null}
    />
  );
}
