"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { LEDE } from "@/components/dashboard/layout-classes";
import { useMarket } from "@/components/app-detail/use-market";
import {
  formatCompact,
  formatCountry,
  formatDate,
  formatPrice,
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
    snapshot?.installs != null
      ? `${formatCompact(snapshot.installs)} installs`
      : null,
    snapshot?.version ? `v${snapshot.version}` : null,
    snapshot?.price != null
      ? formatPrice(snapshot.price, snapshot.currency)
      : null,
    snapshot ? `Snapshot ${formatDate(snapshot.capturedAt)}${where}` : null,
  ].filter((fact) => fact !== null);

  return (
    <p className={LEDE}>
      {facts.length > 0
        ? facts.join(" · ")
        : "No store snapshot yet. Refresh to capture one."}
    </p>
  );
}
