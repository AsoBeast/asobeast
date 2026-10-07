"use client";

import { useSyncExternalStore } from "react";
import {
  useQueryClient,
  type InferDataFromTag,
  type QueryKey,
} from "@tanstack/react-query";

export function useCachedQueryData<TKey extends QueryKey>(
  queryKey: TKey,
): InferDataFromTag<unknown, TKey> | undefined {
  const queryClient = useQueryClient();
  return useSyncExternalStore(
    (onChange) => queryClient.getQueryCache().subscribe(onChange),
    () => queryClient.getQueryData(queryKey),
    () => undefined,
  );
}
