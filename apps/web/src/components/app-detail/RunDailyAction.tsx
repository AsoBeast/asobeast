"use client";

import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { CalendarClock, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runDaily, apiErrorMessage } from "@/lib/api";
import { appKeys } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

export function RunDailyAction({ appId }: { appId: string }) {
  const queryClient = useQueryClient();
  const t = useTranslations("jobs");
  const busy = useIsMutating({ mutationKey: ["app-action", appId] }) > 0;

  const mutation = useMutation({
    mutationKey: ["app-action", appId, "run-daily"],
    mutationFn: () => runDaily(appId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: appKeys.detail(appId) });
      const { apps, keywords, categories, reviews } = result.enqueued;
      const jobs = apps + keywords + categories + reviews;
      if (jobs === 0) {
        toast.info(t("runDaily.nothingTitle"), {
          description: t("runDaily.nothingBody"),
        });
        return;
      }
      const message =
        keywords > 0
          ? t("runDaily.rankChecks", { count: keywords })
          : t("runDaily.jobs", { count: jobs });
      toast.info(t("runDaily.queued", { message }), {
        description: t("runDaily.follow"),
      });
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, t("runDaily.failed")));
    },
  });
  const runOnce = useSingleFlight(mutation);

  return (
    <Button
      variant="outline"
      aria-disabled={busy || undefined}
      onClick={() => {
        if (!busy) runOnce();
      }}
      aria-label={t("runDaily.action")}
    >
      {mutation.isPending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <CalendarClock />
      )}
      <span className="hidden lg:inline">{t("runDaily.action")}</span>
    </Button>
  );
}
