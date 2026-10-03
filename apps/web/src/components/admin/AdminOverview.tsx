"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { PLANS, type AdminOverview as Overview } from "@asobeast/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatTile, StatTileGroup } from "@/components/ui/stat-tile";
import { formatNumber, pluralize, storeLabel } from "@/lib/format";
import { adminOverviewOptions } from "@/lib/queries";
import { SignupsChart } from "./SignupsChart";

const joinParts = (parts: (string | null)[]) =>
  parts.filter(Boolean).join(" · ") || undefined;

const countedPart = (count: number, label: string) =>
  count > 0 ? `${formatNumber(count)} ${label}` : null;

function OverviewTiles({ overview }: { overview: Overview }) {
  const { workspaces, users, apps, keywords } = overview;
  return (
    <StatTileGroup>
      <StatTile
        label="Workspaces"
        value={formatNumber(workspaces.total)}
        note={joinParts([
          countedPart(workspaces.suspended, "suspended"),
          countedPart(workspaces.pendingDeletion, "pending deletion"),
        ])}
      />
      <StatTile
        label="Users"
        value={formatNumber(users.total)}
        note={joinParts([
          `${formatNumber(users.emailVerified)} confirmed`,
          `${formatNumber(users.joinedLast7Days)} joined this week`,
        ])}
      />
      <StatTile
        label="Tracked apps"
        value={formatNumber(apps.tracked)}
        note={pluralize(apps.competitors, "competitor")}
      />
      <StatTile
        label="Keyword markets"
        value={formatNumber(keywords.trackedMarkets)}
        note={`tracked across ${pluralize(keywords.storefronts, "storefront")}`}
      />
      <StatTile
        label="Searched keywords"
        value={formatNumber(keywords.searched)}
        note="one store search each per day"
      />
      <StatTile
        label="AI calls this month"
        value={formatNumber(overview.aiCallsThisMonth)}
      />
    </StatTileGroup>
  );
}

function CountList({
  rows,
}: {
  rows: { key: string; label: string; count: number }[];
}) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.key} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="numeric text-right font-mono">
            {formatNumber(row.count)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminOverview() {
  const { data: overview } = useSuspenseQuery(adminOverviewOptions);

  return (
    <div className="flex flex-col gap-6">
      <OverviewTiles overview={overview} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>Sign ups, last 30 days</h2>
            </CardTitle>
            <CardDescription>
              {pluralize(overview.users.joinedLast30Days, "account")} joined in
              the last 30 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignupsChart signups={overview.signups} />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6">
          {overview.billing ? (
            <Card>
              <CardHeader>
                <CardTitle asChild>
                  <h2>Plans</h2>
                </CardTitle>
                <CardDescription>
                  The plan each workspace is on right now.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CountList
                  rows={overview.workspaces.byPlan.map(({ key, count }) => ({
                    key,
                    label: PLANS[key].displayName,
                    count,
                  }))}
                />
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle asChild>
                <h2>Apps by store</h2>
              </CardTitle>
              <CardDescription>
                Tracked apps, competitors aside.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CountList
                rows={overview.apps.byStore.map(({ key, count }) => ({
                  key,
                  label: storeLabel(key),
                  count,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
