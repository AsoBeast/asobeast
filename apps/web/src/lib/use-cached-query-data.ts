"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  notifyManager,
  useQueryClient,
  type InferDataFromTag,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

export function subscribeToQueryCache(queryClient: QueryClient) {
  return (onChange: () => void) =>
    queryClient.getQueryCache().subscribe(notifyManager.batchCalls(onChange));
}

export function useCachedQueryData<TKey extends QueryKey>(
  queryKey: TKey,
): InferDataFromTag<unknown, TKey> | undefined {
  const queryClient = useQueryClient();
  const subscribe = useMemo(
    () => subscribeToQueryCache(queryClient),
    [queryClient],
  );
  return useSyncExternalStore(
    subscribe,
    () => queryClient.getQueryData(queryKey),
    () => undefined,
  );
}
