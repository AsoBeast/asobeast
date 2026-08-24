"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { AppIcon } from "@/components/AppIcon";
import {
  formatCompact,
  formatDate,
  formatNumber,
  formatPrice,
  formatRating,
} from "@/lib/format";
import { appDetailOptions } from "@/lib/queries";

export function SnapshotFacts({ id }: { id: string }) {
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const snapshot = detail.latestSnapshot;

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
    snapshot ? `Snapshot ${formatDate(snapshot.capturedAt)}` : null,
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
