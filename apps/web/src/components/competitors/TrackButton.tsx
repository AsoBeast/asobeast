"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addCompetitor, ApiError } from "@/lib/api";
import { armFocusHandoff, renewFocusHandoff } from "@/lib/focus-handoff";
import { invalidateCompetitorMutation } from "@/lib/queries";
import { busyRetry } from "@/lib/query-retry";
import { useSingleFlight } from "@/lib/single-flight";

export function TrackButton({
  id,
  storeAppId,
  title,
  label,
  focusKey,
  className,
}: {
  id: string;
  storeAppId: string;
  title: string;
  label?: string;
  focusKey?: string;
  className?: string;
}) {
  const t = useTranslations("competitors");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...busyRetry,
    mutationFn: () => addCompetitor(id, storeAppId),
    onSuccess: (competitor) => {
      if (focusKey) renewFocusHandoff(focusKey);
      invalidateCompetitorMutation(queryClient, id);
      toast.success(t("tracking", { name: competitor.name ?? title }));
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : t("trackFailed", { title }),
      );
    },
  });
  const trackOnce = useSingleFlight(mutation);

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      aria-label={label}
      aria-disabled={mutation.isPending || undefined}
      onClick={() => {
        if (focusKey) armFocusHandoff(focusKey);
        trackOnce();
      }}
    >
      {mutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
      {t("track")}
    </Button>
  );
}
