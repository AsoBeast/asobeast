"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { META_LINE } from "@/components/layout/panel-classes";
import { useMarket } from "@/components/app-detail/use-market";
import {
  formatCompact,
  formatCountry,
  formatDate,
  formatPrice,
} from "@/lib/format";
import { queryMarket } from "@/lib/market";
import { appListingOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function SnapshotFacts({ id }: { id: string }) {
  const { market, home } = useMarket(id);
  const country = queryMarket(market, home);
  const { data: detail } = useSuspenseQuery(appListingOptions(id, country));
  const snapshot = detail.latestSnapshot;
  const where = country === undefined ? "" : ` · ${formatCountry(country)}`;

  const facts = [
    snapshot?.installs != null
      ? `${formatCompact(snapshot.installs)} installs`
      : null,
    snapshot?.version ? `v${snapshot.version}` : null,
    snapshot?.price != null
      ? formatPrice(snapshot.price, snapshot.currency)
      : null,
    snapshot ? `Snapshot ${formatDate(snapshot.capturedAt)}${where}` : null,
  ].filter((fact) => fact !== null);

  if (facts.length === 0) {
    return (
      <p className={META_LINE}>
        No store snapshot yet. Refresh to capture one.
      </p>
    );
  }

  return (
    <ul className={cn(META_LINE, "flex flex-wrap items-center gap-x-2")}>
      {facts.map((fact, index) => (
        <li key={fact} className="flex items-center gap-x-2">
          {index > 0 ? <span aria-hidden>·</span> : null}
          <span>{fact}</span>
        </li>
      ))}
    </ul>
  );
}
