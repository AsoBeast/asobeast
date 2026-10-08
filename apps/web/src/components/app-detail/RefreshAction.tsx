"use client";

import { useId, useState } from "react";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { SnapshotDiffResult } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { ApiError, refreshApp } from "@/lib/api";
import { formatCountry } from "@/lib/format";
import { invalidateAppListing } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { SnapshotDiffDialog } from "./SnapshotDiffDialog";
import { useCachedMarket } from "./use-market";

interface RefreshedListing {
  diff: SnapshotDiffResult;
  market: string | null;
}

export function RefreshAction({ appId }: { appId: string }) {
  const queryClient = useQueryClient();
  const { market: country, refreshable } = useCachedMarket(appId);
  const reasonId = useId();
  const [refreshed, setRefreshed] = useState<RefreshedListing | null>(null);
  const busy = useIsMutating({ mutationKey: ["app-action", appId] }) > 0;

  const mutation = useMutation({
    mutationKey: ["app-action", appId, "refresh"],
    mutationFn: (market: string | undefined) => refreshApp(appId, market),
    onSuccess: (diff, market) => {
      invalidateAppListing(queryClient, appId);
      setRefreshed({ diff, market: market ?? null });
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.envelope.message : "Refresh failed",
      );
    },
  });
  const refreshOnce = useSingleFlight(mutation);

  return (
    <>
      <Button
        variant="outline"
        className="aria-disabled:opacity-60"
        disabled={busy}
        aria-disabled={refreshable ? undefined : true}
        aria-describedby={refreshable ? undefined : reasonId}
        title={refreshable ? undefined : staleReason(country)}
        onClick={() => {
          if (refreshable) refreshOnce(country);
        }}
        aria-label={
          country === undefined
            ? "Refresh"
            : `Refresh ${formatCountry(country)} listing`
        }
      >
        {mutation.isPending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <RefreshCw />
        )}
        <span className="hidden lg:inline">Refresh</span>
      </Button>
      {refreshable ? null : (
        <span id={reasonId} className="sr-only">
          {staleReason(country)}
        </span>
      )}
      <SnapshotDiffDialog
        diff={refreshed?.diff ?? null}
        market={refreshed?.market ?? null}
        open={refreshed !== null}
        onOpenChange={(open) => {
          if (!open) setRefreshed(null);
        }}
      />
    </>
  );
}

function staleReason(country: string | undefined): string {
  const name = country === undefined ? "this market" : formatCountry(country);
  return `No keywords are tracked in ${name} any more, so its listing is no longer refreshed.`;
}
