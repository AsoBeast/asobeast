"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, startSpider } from "@/lib/api";
import { useSingleFlight } from "@/lib/single-flight";
import { toastDeepSearchQueued } from "./deep-search";

export function useIdeasStart(id: string, seed: string, country: string) {
  const start = useMutation({
    mutationFn: () => startSpider(id, seed, country),
    onSuccess: toastDeepSearchQueued,
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
