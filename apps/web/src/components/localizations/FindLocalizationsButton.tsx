"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { detectAppLocalizations, apiErrorMessage } from "@/lib/api";
import { appKeys, invalidateLocalizationMutation } from "@/lib/queries";
import { queuedToast } from "@/lib/queued-toast";
import { useSingleFlight } from "@/lib/single-flight";

const FOLLOW_INTERVAL_MS = 5_000;
const FOLLOW_LIMIT_MS = 90_000;

export function FindLocalizationsButton({ appId }: { appId: string }) {
  const t = useTranslations("localizations");
  const queryClient = useQueryClient();
  const [following, setFollowing] = useState(false);

  const detect = useMutation({
    mutationFn: () => detectAppLocalizations(appId),
    onSuccess: ({ queued }) => {
      if (queued === 0) {
        toast.info(t("find.none"));
        return;
      }
      queuedToast("localizations", t("find.checking", { count: queued }));
      void queryClient.invalidateQueries({
        queryKey: appKeys.localizations(appId),
      });
      setFollowing(true);
    },
    onError: (error) => toast.error(apiErrorMessage(error, t("find.failed"))),
  });
  const detectOnce = useSingleFlight(detect);

  useEffect(() => {
    if (!following) return;
    const tick = setInterval(() => {
      void queryClient.invalidateQueries({
        queryKey: appKeys.localizations(appId),
      });
    }, FOLLOW_INTERVAL_MS);
    const stop = setTimeout(() => {
      setFollowing(false);
      invalidateLocalizationMutation(queryClient, appId);
    }, FOLLOW_LIMIT_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
  }, [following, queryClient, appId]);

  return (
    <Button
      variant="outline"
      size="sm"
      aria-disabled={detect.isPending || undefined}
      onClick={() => detectOnce()}
    >
      {detect.isPending ? <Loader2 className="animate-spin" /> : <ScanSearch />}
      {t("find.button")}
    </Button>
  );
}
