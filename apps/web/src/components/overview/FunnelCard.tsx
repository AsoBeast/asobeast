"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import type {
  StoreFunnelChange,
  StoreFunnelReport,
  StoreFunnelWindow,
} from "@asobeast/shared";
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
  FUNNEL_HEADLINE_DAYS,
  FUNNEL_SERIES_DAYS,
  formatConversion,
  formatCount,
  funnelState,
  searchShare,
  trendValue,
  windowOf,
} from "@/lib/funnel";
import { funnelOptions, storeConnectionsOptions } from "@/lib/queries";
import { appStateLabel } from "@/lib/store-connection-copy";
import { FunnelHelp } from "./FunnelHelp";
import { FunnelTilesSkeleton } from "./skeletons";

const FRESHNESS_NOTE =
  "Apple finishes a day within three days; the newest days may still grow.";

interface Tile {
  label: string;
  metric: keyof StoreFunnelChange;
  value: (window: StoreFunnelWindow | null) => string;
}

const TILES: Tile[] = [
  {
    label: "Impressions",
    metric: "impressions",
    value: (window) => formatCount(window?.current?.impressions ?? null),
  },
  {
    label: "Product page views",
    metric: "pageViews",
    value: (window) => formatCount(window?.current?.pageViews ?? null),
  },
  {
    label: "Get taps",
    metric: "gets",
    value: (window) => formatCount(window?.current?.gets ?? null),
  },
  {
    label: "Conversion",
    metric: "conversion",
    value: (window) => formatConversion(window?.current?.conversion ?? null),
  },
];

function NotReporting({ reason }: { reason: string }) {
  return (
    <EmptyState
      title={`App Store Connect reports nothing for this app yet: ${reason}.`}
      body="The connected key sees this app once it belongs to the key's team and Apple has published its first report."
    />
  );
}

function NotConnected({ id }: { id: string }) {
  const { isOwner } = useAuth();
  const { data: connections } = useSuspenseQuery(storeConnectionsOptions);
  const connection = connections.connections.find(
    (item) => item.store === "APP_STORE",
  );
  if (connection) {
    const app = connection.apps.find((item) => item.appId === id);
    return (
      <NotReporting
        reason={
          connection.status === "rejected"
            ? "the key was refused"
            : appStateLabel(app?.state ?? null)
        }
      />
    );
  }
  return (
    <EmptyState
      title="Connect App Store Connect to see impressions and conversion here."
      body={
        isOwner
          ? "A key from App Store Connect lets AsoBeast read Apple's own numbers for this app, back to 2024."
          : "Ask the workspace owner to connect App Store Connect."
      }
      action={
        isOwner ? (
          <Link
            href="/settings#store-connections"
            className="text-body font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2"
          >
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

  return (
    <div className="flex flex-col gap-3">
      <StatTileGroup>
        {TILES.map((tile) => (
          <StatTile
            key={tile.label}
            label={tile.label}
            value={tile.value(headline)}
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
        {share === null ? null : `Search: ${share}% of impressions. `}
        {headline && settled
          ? `Last 28 complete days through ${formatDate(headline.to)}, against the 28 before.`
          : FRESHNESS_NOTE}
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
    <NotConnected id={id} />
  ) : (
    <FunnelTiles report={report} />
  );
}

export function FunnelCard({ id }: { id: string }) {
  const { country, switchable } = useKeywordScope(id);
  const { data: connections } = useSuspenseQuery(storeConnectionsOptions);
  if (!connections.available) return null;
  const market = switchable
    ? ` · ${country?.toUpperCase() ?? "All markets"}`
    : "";

  return (
    <Card>
      <CardHeader>
        <CardDescription>App Store Connect</CardDescription>
        <CardTitle>Store funnel{market}</CardTitle>
        <CardAction>
          <FunnelHelp />
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
