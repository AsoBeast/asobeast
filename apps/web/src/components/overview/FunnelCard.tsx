"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { Store, StoreFunnelReport } from "@asobeast/shared";
import { useKeywordScope } from "@/components/app-detail/use-market";
import { useAuth } from "@/components/auth/use-auth";
import { MIN_TREND_POINTS } from "@/lib/trend-points";
import { TrendLine } from "@/components/charts/Sparkline";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendChip } from "@/components/ui/delta-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricStrip, StatTile } from "@/components/ui/stat-tile";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { formatDateInLocale } from "@/lib/format";
import {
  FUNNEL_HEADLINE_DAYS,
  FUNNEL_SERIES_DAYS,
  formatConversion,
  formatCount,
  funnelCopy,
  funnelState,
  funnelTiles,
  funnelTrend,
  refusalBody,
  searchShare,
  trendValue,
  windowOf,
  type FunnelTile,
} from "@/lib/funnel";
import { funnelOptions, storeConnectionsOptions } from "@/lib/queries";
import {
  appStateLabel,
  STORE_CONNECTIONS_PATH,
} from "@/lib/store-connection-copy";
import { useAppLocale } from "@/lib/use-app-locale";
import { PANEL_ACTION, PANEL_HEADER } from "@/components/layout/panel-classes";
import { cn } from "@/lib/utils";
import { FunnelHelp } from "./FunnelHelp";
import { FunnelTilesSkeleton } from "./skeletons";

const CONNECT_LINK = "text-body font-medium text-foreground link-underline";

function NotReporting({
  store,
  reason,
  translator,
}: {
  store: Store;
  reason: string;
  translator: MessageTranslator;
}) {
  const copy = funnelCopy(store, translator);
  return (
    <EmptyState
      title={translator("funnel.notReporting", {
        console: copy.console,
        reason,
      })}
      body={copy.notReporting}
    />
  );
}

function ConnectionRefused({
  store,
  reason,
  translator,
}: {
  store: Store;
  reason: string | null;
  translator: MessageTranslator;
}) {
  const { isOwner } = useAuth();
  return (
    <EmptyState
      title={funnelCopy(store, translator).refusedTitle}
      body={refusalBody(store, reason, isOwner, translator)}
      action={
        isOwner ? (
          <Link href={STORE_CONNECTIONS_PATH} className={CONNECT_LINK}>
            {translator("funnel.verify")}
          </Link>
        ) : null
      }
    />
  );
}

function NotConnected({
  id,
  store,
  translator,
}: {
  id: string;
  store: Store;
  translator: MessageTranslator;
}) {
  const connectionT = useTranslations("integrations");
  const { isOwner } = useAuth();
  const copy = funnelCopy(store, translator);
  const { data: connections } = useSuspenseQuery(storeConnectionsOptions);
  const connection = connections.connections.find(
    (item) => item.store === store,
  );
  if (connection?.status === "rejected")
    return (
      <ConnectionRefused
        store={store}
        reason={connection.lastError}
        translator={translator}
      />
    );
  if (connection) {
    const app = connection.apps.find((item) => item.appId === id);
    return (
      <NotReporting
        store={store}
        reason={appStateLabel(app?.state ?? null, store, connectionT)}
        translator={translator}
      />
    );
  }
  return (
    <EmptyState
      title={copy.connectTitle}
      body={isOwner ? copy.connectBody : copy.askOwner}
      action={
        isOwner ? (
          <Link href={STORE_CONNECTIONS_PATH} className={CONNECT_LINK}>
            {translator("funnel.connect")}
          </Link>
        ) : null
      }
    />
  );
}

function FunnelTrend({
  report,
  tile,
  translator,
  locale,
}: {
  report: StoreFunnelReport;
  tile: FunnelTile;
  translator: MessageTranslator;
  locale: Locale;
}) {
  const values = funnelTrend(report, tile.metric, FUNNEL_HEADLINE_DAYS);
  const latest = values.at(-1) ?? null;
  return values.length < MIN_TREND_POINTS ? null : (
    <TrendLine
      values={values}
      label={translator("funnel.trendLabel", {
        label: tile.label,
        count: values.length,
      })}
      now={
        tile.metric === "conversion"
          ? formatConversion(latest, locale)
          : formatCount(latest, locale)
      }
      className="max-sm:hidden print:hidden"
    />
  );
}

function FunnelTiles({
  report,
  translator,
  locale,
}: {
  report: StoreFunnelReport;
  translator: MessageTranslator;
  locale: Locale;
}) {
  const headline = windowOf(report, FUNNEL_HEADLINE_DAYS);
  const week = windowOf(report, 7);
  const share = searchShare(report, headline);
  const settled = headline?.status === "measured";
  const copy = funnelCopy(report.store, translator);
  const tiles = funnelTiles(report, translator);
  const search =
    share === null
      ? ""
      : translator("funnel.footer.search", { share, base: copy.base });
  const footer =
    headline && settled
      ? translator("funnel.footer.measured", {
          console: copy.console,
          search,
          days: FUNNEL_HEADLINE_DAYS,
          date: formatDateInLocale(headline.to, locale),
        })
      : translator("funnel.footer.fresh", {
          console: copy.console,
          freshness: copy.freshness,
        });

  return (
    <>
      <MetricStrip columns={tiles.length} framed={false}>
        {tiles.map((tile) => (
          <StatTile
            key={tile.metric}
            label={tile.label}
            value={
              tile.metric === "conversion"
                ? formatConversion(
                    headline?.current?.conversion ?? null,
                    locale,
                  )
                : formatCount(headline?.current?.[tile.metric] ?? null, locale)
            }
            delta={
              <TrendChip
                label={translator("charts.daysShort", {
                  count: FUNNEL_HEADLINE_DAYS,
                })}
                unit="%"
                value={trendValue(headline, tile.metric)}
                form="pill"
              />
            }
            note={
              <span className="flex items-center justify-between gap-3">
                <TrendChip
                  label={translator("charts.daysShort", { count: 7 })}
                  unit="%"
                  value={trendValue(week, tile.metric)}
                />
                <FunnelTrend
                  report={report}
                  tile={tile}
                  translator={translator}
                  locale={locale}
                />
              </span>
            }
          />
        ))}
      </MetricStrip>
      <CardFooter>{footer}</CardFooter>
    </>
  );
}

function FunnelBody({
  id,
  translator,
  locale,
}: {
  id: string;
  translator: MessageTranslator;
  locale: Locale;
}) {
  const { country } = useKeywordScope(id);
  const { data: report } = useSuspenseQuery(
    funnelOptions(id, FUNNEL_SERIES_DAYS, country),
  );
  return funnelState(report) === "off" ? (
    <CardContent>
      <NotConnected id={id} store={report.store} translator={translator} />
    </CardContent>
  ) : (
    <FunnelTiles report={report} translator={translator} locale={locale} />
  );
}

export function FunnelCard({ id, store }: { id: string; store: Store }) {
  const t = useTranslations("overview");
  const locale = useAppLocale();
  const { country, switchable } = useKeywordScope(id);
  const { data: connections } = useSuspenseQuery(storeConnectionsOptions);
  if (!connections.available) return null;
  const market = switchable
    ? (country?.toUpperCase() ?? t("funnel.allMarkets"))
    : "";
  const title =
    switchable && market ? t("funnel.scoped", { market }) : t("funnel.title");

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className={cn(PANEL_HEADER, "border-b border-border")}>
        <CardTitle asChild>
          <h2>{title}</h2>
        </CardTitle>
        <CardAction className={PANEL_ACTION}>
          <FunnelHelp store={store} />
        </CardAction>
      </CardHeader>
      <Suspense fallback={<FunnelTilesSkeleton store={store} />}>
        <FunnelBody id={id} translator={t} locale={locale} />
      </Suspense>
    </Card>
  );
}
