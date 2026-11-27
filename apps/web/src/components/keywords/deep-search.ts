import { queuedToast } from "@/lib/queued-toast";

export const DEEP_SEARCH_PROBES = 27;

export const DEEP_SEARCH_LENGTH = `${DEEP_SEARCH_PROBES} lookups, usually about two minutes`;

export function toastDeepSearchQueued(): void {
  queuedToast(
    DEEP_SEARCH_LENGTH,
    "Results fill in as each lookup completes. It takes longer while the daily run is collecting.",
  );
}
