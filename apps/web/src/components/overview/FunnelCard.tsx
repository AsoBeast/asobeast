"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { Store, StoreFunnelReport } from "@asobeast/shared";
import { useKeywordScope } from "@/components/app-detail/use-market";
import { useAuth } from "@/components/auth/use-auth";
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
import { StatTile, StatTileGroup } from "@/components/ui/stat-tile";
import { formatDate } from "@/lib/format";
import {
  FUNNEL_COPY,
  FUNNEL_HEADLINE_DAYS,
  FUNNEL_SERIES_DAYS,
  formatConversion,
  formatCount,
  funnelState,
  funnelTiles,
  searchShare,
  trendValue,
  windowOf,
} from "@/lib/funnel";
import { funnelOptions, storeConnectionsOptions } from "@/lib/queries";
import {
  appStateLabel,
  STORE_CONNECTIONS_PATH,
} from "@/lib/store-connection-copy";
import { PANEL_ACTION, PANEL_HEADER } from "@/components/layout/panel-classes";
import { cn } from "@/lib/utils";
import { FunnelHelp } from "./FunnelHelp";
import { PULSE_COLUMNS, PULSE_STRIP } from "./layout-classes";
import { FunnelTilesSkeleton } from "./skeletons";

const CONNECT_LINK =
  "text-body font-medium text-foreground underline decoration-faint-foreground underline-offset-4 hover:decoration-2";

function NotReporting({ store, reason }: { store: Store; reason: string }) {
  const copy = FUNNEL_COPY[store];
  return (
    <EmptyState
      title={`${copy.console} reports nothing for this app yet: ${reason}.`}
      body={copy.notReporting}
    />
  );
}

function ConnectionRefused({ store }: { store: Store }) {
  const { isOwner } = useAuth();
  const copy = FUNNEL_COPY[store];
  return (
    <EmptyState
      title={copy.refusedTitle}
      body={isOwner ? copy.refusedBody : copy.refusedAskOwner}
      action={
        isOwner ? (
          <Link href={STORE_CONNECTIONS_PATH} className={CONNECT_LINK}>
            Verify in Integrations
          </Link>
        ) : null
      }
    />
  );
}

function NotConnected({ id, store }: { id: string; store: Store }) {
  const { isOwner } = useAuth();
  const copy = FUNNEL_COPY[store];
  const { data: connections } = useSuspenseQuery(storeConnectionsOptions);
  const connection = connections.connections.find(
    (item) => item.store === store,
  );
  if (connection?.status === "rejected")
    return <ConnectionRefused store={store} />;
  if (connection) {
    const app = connection.apps.find((item) => item.appId === id);
    return (
      <NotReporting
        store={store}
        reason={appStateLabel(app?.state ?? null, store)}
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
            Connect in Integrations
          </Link>
        ) : null
      }
    />
  );
}

function FunnelTiles({ report }: { report: StoreFunnelReport }) {
  const headline = windowOf(report, FUNNEL_HEADLINE_DAYS);
  const week = windowOf(report, 7);
  const share = searchShare(report, headline);
  const settled = headline?.status === "measured";
  const copy = FUNNEL_COPY[report.store];

  const tiles = funnelTiles(report);

  return (
    <>
      <StatTileGroup className={cn(PULSE_STRIP, PULSE_COLUMNS[tiles.length])}>
        {tiles.map((tile) => (
          <StatTile
            key={tile.label}
            label={tile.label}
            value={
              <span className="flex flex-wrap items-center gap-2">
                <span>
                  {tile.metric === "conversion"
                    ? formatConversion(headline?.current?.conversion ?? null)
                    : formatCount(headline?.current?.[tile.metric] ?? null)}
                </span>
                <TrendChip
                  label="28d"
                  unit="%"
                  value={trendValue(headline, tile.metric)}
                  form="pill"
                />
              </span>
            }
            note={
              <TrendChip
                label="7d"
                unit="%"
                value={trendValue(week, tile.metric)}
              />
            }
          />
        ))}
      </StatTileGroup>
      <CardFooter>
        {`${copy.console}. ${share === null ? "" : `Search: ${share}% of ${copy.base}. `}${
          headline && settled
            ? `Last 28 complete days through ${formatDate(headline.to)}, against the 28 before.`
            : copy.freshness
        }`}
      </CardFooter>
    </>
  );
}

function FunnelBody({ id }: { id: string }) {
  const { country } = useKeywordScope(id);
  const { data: report } = useSuspenseQuery(
    funnelOptions(id, FUNNEL_SERIES_DAYS, country),
  );
  return funnelState(report) === "off" ? (
    <CardContent>
      <NotConnected id={id} store={report.store} />
    </CardContent>
  ) : (
    <FunnelTiles report={report} />
  );
}

export function FunnelCard({ id, store }: { id: string; store: Store }) {
  const { country, switchable } = useKeywordScope(id);
  const { data: connections } = useSuspenseQuery(storeConnectionsOptions);
  if (!connections.available) return null;
  const market = switchable
    ? ` · ${country?.toUpperCase() ?? "All markets"}`
    : "";

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className={cn(PANEL_HEADER, "border-b border-border")}>
        <CardTitle asChild>
          <h2>{`Store funnel${market}`}</h2>
        </CardTitle>
        <CardAction className={PANEL_ACTION}>
          <FunnelHelp store={store} />
        </CardAction>
      </CardHeader>
      <Suspense fallback={<FunnelTilesSkeleton store={store} />}>
        <FunnelBody id={id} />
      </Suspense>
    </Card>
  );
}
