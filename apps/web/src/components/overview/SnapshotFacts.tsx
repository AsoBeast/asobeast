"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { AppIcon } from "@/components/AppIcon";
import { useMarket } from "@/components/app-detail/use-market";
import {
  formatCompact,
  formatCountry,
  formatDate,
  formatNumber,
  formatPrice,
  formatRating,
} from "@/lib/format";
import { queryMarket } from "@/lib/market";
import { appListingOptions } from "@/lib/queries";

export function SnapshotFacts({ id }: { id: string }) {
  const { market, home } = useMarket(id);
  const country = queryMarket(market, home);
  const { data: detail } = useSuspenseQuery(appListingOptions(id, country));
  const snapshot = detail.latestSnapshot;
  const where = country === undefined ? "" : ` · ${formatCountry(country)}`;

  const facts = [
    snapshot?.ratingAvg != null
      ? `★ ${formatRating(snapshot.ratingAvg)}${
          snapshot.ratingCount != null
            ? ` (${formatNumber(snapshot.ratingCount)})`
            : ""
        }`
      : null,
    snapshot?.installs != null
      ? `${formatCompact(snapshot.installs)} installs`
      : null,
    snapshot?.version ? `v${snapshot.version}` : null,
    snapshot?.price != null ? formatPrice(snapshot.price) : null,
    snapshot ? `Snapshot ${formatDate(snapshot.capturedAt)}${where}` : null,
  ].filter((fact): fact is string => fact !== null);

  return (
    <div className="flex items-center gap-3">
      <AppIcon src={detail.iconUrl} name={detail.name} size={48} />
      {facts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted-foreground">
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </div>
      ) : (
        <p className="text-body text-muted-foreground">
          No store snapshot yet. Refresh to capture one.
        </p>
      )}
    </div>
  );
}
