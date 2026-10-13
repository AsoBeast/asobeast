"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError, detectAppLocalizations } from "@/lib/api";
import { pluralize } from "@/lib/format";
import { appKeys, invalidateLocalizationMutation } from "@/lib/queries";
import { queuedToast } from "@/lib/queued-toast";
import { useSingleFlight } from "@/lib/single-flight";

const FOLLOW_INTERVAL_MS = 5_000;
const FOLLOW_LIMIT_MS = 90_000;

export function FindLocalizationsButton({ appId }: { appId: string }) {
  const queryClient = useQueryClient();
  const [following, setFollowing] = useState(false);

  const detect = useMutation({
    mutationFn: () => detectAppLocalizations(appId),
    onSuccess: ({ queued }) => {
      if (queued === 0) {
        toast.info(
          "Every language your markets read is already listed or was checked today.",
        );
        return;
      }
      queuedToast(
        "localizations",
        `Checking ${pluralize(queued, "language")} in the App Store. Detected ones appear here.`,
      );
      void queryClient.invalidateQueries({
        queryKey: appKeys.localizations(appId),
      });
      setFollowing(true);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : "Could not look for localizations",
      ),
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
      disabled={detect.isPending}
      onClick={() => detectOnce()}
    >
      {detect.isPending ? <Loader2 className="animate-spin" /> : <ScanSearch />}
      Find localizations
    </Button>
  );
}
