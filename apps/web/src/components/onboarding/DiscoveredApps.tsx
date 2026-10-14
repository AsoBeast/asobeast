"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { TrackButton } from "@/components/competitors/TrackButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { discoveryOptions } from "@/lib/queries";
import {
  DISCOVERY_WINDOW_DAYS,
  discoveredEmptyText,
  discoveredRows,
} from "./discovered-apps";

export function DiscoveredApps({
  appId,
  collecting,
}: {
  appId: string;
  collecting: boolean;
}) {
  const headingId = useId();
  const discovery = useQuery(discoveryOptions(appId, DISCOVERY_WINDOW_DAYS));
  const rows = discoveredRows(discovery.data);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h4 id={headingId} className="text-sm font-medium">
        Apps ranking for your keywords
      </h4>
      {discovery.isError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          Could not load the apps ranking beside you.
          <Button
            size="sm"
            variant="outline"
            onClick={() => void discovery.refetch()}
          >
            <RefreshCw />
            Retry
          </Button>
        </div>
      ) : !discovery.data ? (
        <Skeleton className="h-12 w-full" />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {discoveredEmptyText(collecting, discovery.data.windowDays)}
        </p>
      ) : (
        <ul aria-labelledby={headingId} className="flex flex-col divide-y">
          {rows.map((row) => (
            <li
              key={row.storeAppId}
              className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {row.title}
                </span>
                <span className="truncate text-caption text-muted-foreground">
                  {row.developer ?? "Unknown developer"}
                </span>
                <span className="numeric font-mono text-caption text-muted-foreground">
                  {formatNumber(row.appearances)} appearances · best #
                  {row.bestPosition}
                </span>
              </div>
              <TrackButton
                id={appId}
                storeAppId={row.storeAppId}
                title={row.title}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
