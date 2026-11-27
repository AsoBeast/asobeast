"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatCheckedPosition } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { CHART_NOTICE } from "./ChartStates";
import { CHART_HEIGHT } from "./theme";
import { formatCountryInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";
import { lastCheckedIndex, NOT_CHECKED, type RankingChartData } from "./pivot";

function Frame({
  title,
  body,
  action,
  children,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(CHART_NOTICE, "gap-2", CHART_HEIGHT.hero)}>
      <p className="max-w-prose text-body font-medium">{title}</p>
      <p className="max-w-prose text-body text-muted-foreground">{body}</p>
      {children}
      {action}
    </div>
  );
}

export function NoKeywordsTracked({ id }: { id: string }) {
  const t = useTranslations("charts");
  return (
    <Frame
      title={t("noKeywordsTracked")}
      body={t("noKeywordsTrackedBody")}
      action={
        <Button asChild size="sm" className="print:hidden">
          <Link href={`/apps/${id}/keywords`}>{t("goToKeywords")}</Link>
        </Button>
      }
    />
  );
}

export function NoKeywordsInMarket({
  id,
  country,
  action,
}: {
  id: string;
  country: string;
  action?: React.ReactNode;
}) {
  const t = useTranslations("charts");
  const locale = useAppLocale();
  return (
    <Frame
      title={t("noKeywordsInMarket", {
        country: formatCountryInLocale(country, locale),
      })}
      body={t("noKeywordsInMarketBody")}
      action={
        action === undefined ? (
          <Button asChild size="sm" className="print:hidden">
            <Link href={`/apps/${id}/keywords?country=${country}`}>
              {t("goToKeywords")}
            </Link>
          </Button>
        ) : (
          action
        )
      }
    />
  );
}

export function NoPositionsYet() {
  const t = useTranslations("charts");
  return <Frame title={t("noPositionsYet")} body={t("noPositionsBody")} />;
}

export function NoDataInRange({ onWiden }: { onWiden?: () => void }) {
  const t = useTranslations("charts");
  return (
    <Frame
      title={t("nothingInRange")}
      body={t("nothingInRangeBody")}
      action={
        onWiden ? (
          <Button
            size="sm"
            variant="outline"
            className="print:hidden"
            onClick={onWiden}
          >
            {t("widen90")}
          </Button>
        ) : null
      }
    />
  );
}

export function InsufficientHistory({ data }: { data: RankingChartData }) {
  const t = useTranslations("charts");
  const lastIndex = lastCheckedIndex(data);
  const row = data.rows[lastIndex];
  const depths = data.depths[lastIndex];
  const counts = data.resultCounts[lastIndex];

  return (
    <Frame title={t("insufficientTitle")} body={t("insufficientBody")}>
      <dl className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {data.keywordIds.map((keywordId) => {
          const value = row?.[keywordId];
          return (
            <div key={keywordId} className="flex flex-col items-center">
              <dt className="max-w-40 truncate text-caption text-muted-foreground">
                {data.seriesLabels[keywordId] ?? keywordId}
              </dt>
              <dd className="numeric text-title">
                {formatCheckedPosition(
                  typeof value === "number" ? value : null,
                  depths?.[keywordId] ?? null,
                  counts?.[keywordId] ?? null,
                ) ?? NOT_CHECKED}
              </dd>
            </div>
          );
        })}
      </dl>
    </Frame>
  );
}
