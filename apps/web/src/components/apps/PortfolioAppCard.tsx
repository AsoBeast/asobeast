import Link from "next/link";
import type { PortfolioApp } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TrendChip } from "@/components/ui/delta-chip";
import {
  formatCountry,
  formatDate,
  formatNumber,
  storeLabel,
} from "@/lib/format";
import { DeleteAppMenu } from "./DeleteAppMenu";
import { Sparkline } from "./Sparkline";

export function AppStats({ app }: { app: PortfolioApp }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
      <span>{formatNumber(app.trackedKeywords)} keywords</span>
      <span>{formatNumber(app.competitors)} competitors</span>
      <span>Updated {formatDate(app.lastCapturedAt)}</span>
    </div>
  );
}

export function AppBadges({ app }: { app: PortfolioApp }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" className="w-fit">
        {storeLabel(app.store)}
      </Badge>
      <Badge
        variant="outline"
        className="w-fit"
        title={`Home storefront · ${formatCountry(app.country)}`}
      >
        {app.country.toUpperCase()}
      </Badge>
    </div>
  );
}

export function PortfolioAppCard({ app }: { app: PortfolioApp }) {
  const name = app.name ?? "Untitled app";

  return (
    <Card className="relative gap-0 p-4 transition-colors hover:bg-muted/40">
      <Link
        href={`/apps/${app.id}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="sr-only">{name}</span>
      </Link>

      <div className="absolute top-2 right-2 z-20">
        <DeleteAppMenu id={app.id} name={name} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-4">
          <AppIcon src={app.iconUrl} name={app.name} />
          <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
            <span title={name} className="truncate font-medium">
              {name}
            </span>
            <AppBadges app={app} />
          </div>
        </div>

        {app.lastCapturedAt === null ? (
          <p className="text-body text-muted-foreground">
            Awaiting the first daily run — visibility appears within 24 hours.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <span className="numeric font-mono text-3xl font-semibold">
                {Math.round(app.visibility.current)}
              </span>
              <TrendChip label="7d" value={app.visibility.delta7d} />
            </div>

            <Sparkline points={app.sparkline} />
          </>
        )}

        <AppStats app={app} />
      </div>
    </Card>
  );
}

export function PortfolioGroupMember({ app }: { app: PortfolioApp }) {
  const name = app.name ?? "Untitled app";

  return (
    <div className="relative flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <Link
        href={`/apps/${app.id}`}
        className="absolute inset-0 z-10 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="sr-only">{name}</span>
      </Link>

      <div className="absolute top-2 right-0 z-20">
        <DeleteAppMenu id={app.id} name={name} />
      </div>

      <div className="flex items-center gap-3 pr-6">
        <AppIcon src={app.iconUrl} name={app.name} size={36} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span title={name} className="truncate text-body font-medium">
            {name}
          </span>
          <AppBadges app={app} />
        </div>
        {app.lastCapturedAt === null ? null : (
          <div className="flex flex-col items-end gap-1">
            <span className="numeric font-mono text-2xl font-semibold">
              {Math.round(app.visibility.current)}
            </span>
            <TrendChip label="7d" value={app.visibility.delta7d} />
          </div>
        )}
      </div>

      {app.lastCapturedAt === null ? (
        <p className="text-caption text-muted-foreground">
          Awaiting the first daily run.
        </p>
      ) : (
        <Sparkline points={app.sparkline} />
      )}

      <AppStats app={app} />
    </div>
  );
}
