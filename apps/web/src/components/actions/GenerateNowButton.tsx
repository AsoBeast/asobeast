"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runActions } from "@/lib/api";
import { actionSummaryOptions, invalidateActionMutation } from "@/lib/queries";
import { queuedToast } from "@/lib/queued-toast";

const FOLLOW_INTERVAL_MS = 2_000;
const FOLLOW_LIMIT_MS = 60_000;

interface FollowedRun {
  since: string | null;
  startedAt: number;
}

export function GenerateNowButton({
  generatedAt,
}: {
  generatedAt: string | null;
}) {
  const queryClient = useQueryClient();
  const [followed, setFollowed] = useState<FollowedRun | null>(null);

  const run = useMutation({
    mutationFn: runActions,
    onSuccess: () => {
      queuedToast(
        "action generation",
        "It reads stored data only, so it costs no store requests.",
      );
      setFollowed({ since: generatedAt, startedAt: Date.now() });
    },
    onError: () => toast.error("Could not queue generation"),
  });

  const summary = useQuery({
    ...actionSummaryOptions,
    enabled: followed !== null,
    refetchInterval: followed ? FOLLOW_INTERVAL_MS : false,
  });

  const finished =
    followed !== null &&
    summary.data !== undefined &&
    summary.dataUpdatedAt >= followed.startedAt &&
    summary.data.generatedAt !== followed.since;

  useEffect(() => {
    if (!followed) return;
    const stop = () => {
      setFollowed(null);
      invalidateActionMutation(queryClient);
    };
    if (finished) {
      stop();
      return;
    }
    const timeout = setTimeout(
      stop,
      followed.startedAt + FOLLOW_LIMIT_MS - Date.now(),
    );
    return () => clearTimeout(timeout);
  }, [followed, finished, queryClient]);

  const busy = run.isPending || followed !== null;

  return (
    <Button disabled={busy} onClick={() => run.mutate()}>
      {busy ? "Generating…" : "Generate now"}
    </Button>
  );
}
