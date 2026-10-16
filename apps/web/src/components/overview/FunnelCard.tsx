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
  CardDescription,
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
import { appStateLabel } from "@/lib/store-connection-copy";
import { FunnelHelp } from "./FunnelHelp";
import { FunnelTilesSkeleton } from "./skeletons";

const SETTINGS_LINK =
  "text-body font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2";

function NotReporting({ store, reason }: { store: Store; reason: string }) {
  const copy = FUNNEL_COPY[store];
  return (
    <EmptyState
      title={`${copy.console} reports nothing for this app yet: ${reason}.`}
      body={copy.notReporting}
    />
  );
}

function KeyRefused({ store }: { store: Store }) {
  const { isOwner } = useAuth();
  const copy = FUNNEL_COPY[store];
  return (
    <EmptyState
      title={`${copy.console} refused the connected key.`}
      body={isOwner ? copy.refusedBody : copy.refusedAskOwner}
      action={
        isOwner ? (
          <Link href="/settings#store-connections" className={SETTINGS_LINK}>
            Verify in settings
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
  if (connection?.status === "rejected") return <KeyRefused store={store} />;
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
          <Link href="/settings#store-connections" className={SETTINGS_LINK}>
            Connect in settings
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

  return (
    <div className="flex flex-col gap-3">
      <StatTileGroup>
        {funnelTiles(report).map((tile) => (
          <StatTile
            key={tile.label}
            label={tile.label}
            value={
              tile.metric === "conversion"
                ? formatConversion(headline?.current?.conversion ?? null)
                : formatCount(headline?.current?.[tile.metric] ?? null)
            }
            note={
              <span className="flex flex-wrap gap-3">
                <TrendChip
                  label="7d"
                  unit="%"
                  value={trendValue(week, tile.metric)}
                />
                <TrendChip
                  label="28d"
                  unit="%"
                  value={trendValue(headline, tile.metric)}
                />
              </span>
            }
          />
        ))}
      </StatTileGroup>
      <p className="text-caption text-muted-foreground">
        {share === null ? null : `Search: ${share}% of ${copy.base}. `}
        {headline && settled
          ? `Last 28 complete days through ${formatDate(headline.to)}, against the 28 before.`
          : copy.freshness}
      </p>
    </div>
  );
}

function FunnelBody({ id }: { id: string }) {
  const { country } = useKeywordScope(id);
  const { data: report } = useSuspenseQuery(
    funnelOptions(id, FUNNEL_SERIES_DAYS, country),
  );
  return funnelState(report) === "off" ? (
    <NotConnected id={id} store={report.store} />
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
    <Card>
      <CardHeader>
        <CardDescription>{FUNNEL_COPY[store].console}</CardDescription>
        <CardTitle>Store funnel{market}</CardTitle>
        <CardAction>
          <FunnelHelp store={store} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<FunnelTilesSkeleton />}>
          <FunnelBody id={id} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
