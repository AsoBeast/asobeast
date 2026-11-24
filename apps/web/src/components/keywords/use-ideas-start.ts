"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, startSpider } from "@/lib/api";
import { queuedToast } from "@/lib/queued-toast";
import { useSingleFlight } from "@/lib/single-flight";

export function useIdeasStart(id: string, seed: string, country: string) {
  const start = useMutation({
    mutationFn: () => startSpider(id, seed, country),
    onSuccess: () =>
      queuedToast(
        "27 lookups, usually about two minutes",
        "Results fill in as each lookup completes. It takes longer while the daily run is collecting.",
      ),
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : "Could not start the search for ideas",
      ),
  });
  return {
    pending: start.isPending,
    succeeded: start.isSuccess,
    startOnce: useSingleFlight(start),
  };
}
