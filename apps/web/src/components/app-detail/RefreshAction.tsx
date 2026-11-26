"use client";

import { useId, useRef, useState } from "react";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { SnapshotDiffResult } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { ApiError, refreshApp, apiErrorMessage } from "@/lib/api";
import { formatCountryInLocale } from "@/lib/format";
import { invalidateAppListing } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { SnapshotDiffDialog } from "./SnapshotDiffDialog";
import { useCachedMarket } from "./use-market";

interface RefreshedListing {
  diff: SnapshotDiffResult;
  market: string | null;
}

export function RefreshAction({ appId }: { appId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("appDetail");
  const locale = useAppLocale();
  const { market: country, refreshable } = useCachedMarket(appId);
  const reasonId = useId();
  const [refreshed, setRefreshed] = useState<RefreshedListing | null>(null);
  const busy = useIsMutating({ mutationKey: ["app-action", appId] }) > 0;
  const button = useRef<HTMLButtonElement>(null);

  const mutation = useMutation({
    mutationKey: ["app-action", appId, "refresh"],
    mutationFn: (market: string | undefined) => refreshApp(appId, market),
    onSuccess: (diff, market) => {
      invalidateAppListing(queryClient, appId);
      setRefreshed({ diff, market: market ?? null });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.envelope.statusCode === 404) {
        invalidateAppListing(queryClient, appId);
      }
      toast.error(apiErrorMessage(error, t("refresh.failed")));
    },
  });
  const refreshOnce = useSingleFlight(mutation);

  return (
    <>
      <Button
        ref={button}
        variant="outline"
        aria-disabled={busy || !refreshable || undefined}
        aria-describedby={refreshable ? undefined : reasonId}
        title={refreshable ? undefined : staleReason(country, t, locale)}
        onClick={() => {
          if (refreshable && !busy) refreshOnce(country);
        }}
        aria-label={
          country === undefined
            ? t("refresh.action")
            : t("refresh.listing", {
                country: formatCountryInLocale(country, locale),
              })
        }
      >
        {mutation.isPending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <RefreshCw />
        )}
        <span className="hidden lg:inline">{t("refresh.action")}</span>
      </Button>
      {refreshable ? null : (
        <span id={reasonId} className="sr-only">
          {staleReason(country, t, locale)}
        </span>
      )}
      <SnapshotDiffDialog
        diff={refreshed?.diff ?? null}
        market={refreshed?.market ?? null}
        open={refreshed !== null}
        onOpenChange={(open) => {
          if (!open) setRefreshed(null);
        }}
        returnFocus={button}
      />
    </>
  );
}

function staleReason(
  country: string | undefined,
  translator: MessageTranslator,
  locale: Locale,
): string {
  const name =
    country === undefined
      ? translator("refresh.staleMarket")
      : formatCountryInLocale(country, locale);
  return translator("refresh.staleReason", { market: name });
}
