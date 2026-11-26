"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import type {
  ActionSummary,
  PortfolioApp,
  PortfolioRangeChange,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DirectionArrow, TrendChip } from "@/components/ui/delta-chip";
import { MetricStrip, StatTile } from "@/components/ui/stat-tile";
import { formatNumberInLocale } from "@/lib/format";
import type { MessageTranslator } from "@/i18n/translator";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  actionSummaryOptions,
  portfolioInsightsOptions,
  portfolioOptions,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import { isBrokenDown } from "./breakdown";
import { PULSE_BODY, PULSE_SPLIT } from "./layout-classes";
import { MetricPanel } from "./MetricPanel";
import { PortfolioBreakdown } from "./PortfolioBreakdown";
import { useRangeHistory } from "./use-range-history";
import { useRefreshAfterRun } from "./use-refresh-after-run";
import {
  dashboardMetricParser,
  type DashboardMetric,
} from "@/lib/search-params";

function movedValue(
  change: PortfolioRangeChange,
  locale: ReturnType<typeof useAppLocale>,
): string {
  if (!change.compared) return "—";
  const { up, down } = change.movement;
  return formatNumberInLocale(up + down, locale);
}

function MovedDelta({ change }: { change: PortfolioRangeChange }) {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  if (!change.compared) return null;
  const { up, down } = change.movement;
  return (
    <>
      {up > 0 ? (
        <Badge variant="up">
          <DirectionArrow way="up" />
          <span aria-hidden>{formatNumberInLocale(up, locale)}</span>
          <span className="sr-only">{t("pulse.climbed", { count: up })}</span>
        </Badge>
      ) : null}
      {down > 0 ? (
        <Badge variant="down">
          <DirectionArrow way="down" />
          <span aria-hidden>{formatNumberInLocale(down, locale)}</span>
          <span className="sr-only">{t("pulse.fell", { count: down })}</span>
        </Badge>
      ) : null}
    </>
  );
}

const rangeUnit = (days: number, t: MessageTranslator): string =>
  t("table.rangeUnit", { days });

function movedNote(
  change: PortfolioRangeChange,
  days: number,
  t: MessageTranslator,
): string {
  if (!change.compared) return t("pulse.noCheck", { days });
  const { entered, lost } = change.movement;
  return t("pulse.enteredLost", {
    entered,
    lost,
  });
}

const actionsValue = (
  summary: ActionSummary,
  locale: ReturnType<typeof useAppLocale>,
): string =>
  summary.generatedAt === null
    ? "—"
    : formatNumberInLocale(summary.open, locale);

function ActionsDelta({ summary }: { summary: ActionSummary }) {
  const t = useTranslations("dashboard");
  const { critical } = summary.openByPriority;
  if (summary.generatedAt === null || critical === 0) return null;
  return (
    <Badge variant="down">{t("counts.critical", { count: critical })}</Badge>
  );
}

function actionsNote(summary: ActionSummary, t: MessageTranslator): string {
  if (summary.generatedAt === null) return t("pulse.notGenerated");
  const { high, medium, low } = summary.openByPriority;
  if (summary.open === 0) return t("pulse.nothingWaiting");
  return t("pulse.priorities", {
    high,
    medium,
    low,
  });
}

function visibilityNote(apps: PortfolioApp[], t: MessageTranslator): string {
  const checked = apps.filter((app) => app.lastCapturedAt !== null).length;
  return t("pulse.weightedAcross", { count: checked });
}

export function PortfolioPulse() {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  const { data: insights } = useSuspenseQuery(portfolioInsightsOptions);
  const { data: actions } = useSuspenseQuery(actionSummaryOptions);
  const [metric, setMetric] = useQueryState("metric", dashboardMetricParser);
  const { days, history } = useRangeHistory();
  useRefreshAfterRun();
  if (portfolio.apps.length === 0) return null;

  const { top10 } = insights.totals;
  const { visibilityDelta, top10Delta } = history.change;
  const unit = rangeUnit(days, t);
  const broken = isBrokenDown(history);
  const { visibility } = portfolio;
  const shown: DashboardMetric =
    metric === "visibility" && !visibility ? "top10" : metric;
  const tab = (value: DashboardMetric) => ({
    selected: shown === value,
    onSelect: () => void setMetric(value),
  });

  return (
    <Card className="gap-0 py-0">
      <MetricStrip columns={4} framed={false}>
        {visibility ? (
          <StatTile
            {...tab("visibility")}
            label={t("table.visibility")}
            value={formatNumberInLocale(Math.round(visibility.current), locale)}
            delta={
              <TrendChip label={unit} value={visibilityDelta} form="pill" />
            }
            note={visibilityNote(portfolio.apps, t)}
          />
        ) : null}
        <StatTile
          {...tab("top10")}
          label={t("table.top10")}
          value={formatNumberInLocale(top10, locale)}
          delta={<TrendChip label={unit} value={top10Delta} form="pill" />}
          note={t("pulse.ofTracked", {
            count: portfolio.totals.trackedKeywords,
          })}
        />
        <StatTile
          {...tab("moved")}
          label={t("pulse.movedIn", { days })}
          value={movedValue(history.change, locale)}
          delta={<MovedDelta change={history.change} />}
          note={movedNote(history.change, days, t)}
        />
        <StatTile
          {...tab("actions")}
          label={t("table.actions")}
          value={actionsValue(actions, locale)}
          delta={<ActionsDelta summary={actions} />}
          note={actionsNote(actions, t)}
        />
      </MetricStrip>
      <div className={cn(PULSE_BODY, broken && PULSE_SPLIT)}>
        <MetricPanel metric={shown} />
        <PortfolioBreakdown metric={shown} />
      </div>
    </Card>
  );
}
