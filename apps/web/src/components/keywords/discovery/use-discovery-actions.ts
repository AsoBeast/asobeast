"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  KeywordDiscoveryList,
  KeywordDiscoveryTrackRequest,
} from "@asobeast/shared";
import {
  ApiError,
  dismissKeywordDiscoveries,
  refreshKeywordDiscoveries,
  setKeywordDiscoverySettings,
  trackKeywordDiscoveries,
} from "@/lib/api";
import {
  refreshedToast,
  trackedToast,
  withoutDiscoveries,
} from "@/lib/keyword-discoveries";
import {
  invalidateKeywordDiscoveryMutation,
  keywordDiscoveriesOptions,
} from "@/lib/queries";
import { useKeyedSingleFlight, useSingleFlight } from "@/lib/single-flight";

export interface DiscoveryTrack {
  request: KeywordDiscoveryTrackRequest;
  removes: readonly string[];
}

const failed = (fallback: string) => (error: unknown) =>
  toast.error(error instanceof ApiError ? error.envelope.message : fallback);

const keyOfIds = (ids: readonly string[]): string => JSON.stringify(ids);

const keyOfTrack = ({ request, removes }: DiscoveryTrack): string =>
  JSON.stringify([request.allRanked ?? false, removes]);

export function useDiscoveryActions(
  id: string,
  market: string,
  onTracked: () => void,
) {
  const client = useQueryClient();
  const { queryKey } = keywordDiscoveriesOptions(id, market);
  const removeRows = (ids: readonly string[]) =>
    client.setQueryData<KeywordDiscoveryList>(queryKey, (list) =>
      list ? withoutDiscoveries(list, ids) : list,
    );
  const refetch = () => invalidateKeywordDiscoveryMutation(client, id);

  const track = useMutation({
    mutationKey: ["keyword-discovery", id, market, "track"],
    mutationFn: ({ request }: DiscoveryTrack) =>
      trackKeywordDiscoveries(id, request),
    onSuccess: (result, { removes }) => {
      if (result.skipped === 0) removeRows(removes);
      onTracked();
      toast.success(trackedToast(result));
      refetch();
    },
    onError: failed("Could not track the keywords"),
  });

  const dismiss = useMutation({
    mutationKey: ["keyword-discovery", id, market, "dismiss"],
    mutationFn: (ids: readonly string[]) =>
      dismissKeywordDiscoveries(id, [...ids]),
    onSuccess: (_result, ids) => {
      removeRows(ids);
      refetch();
    },
    onError: failed("Could not dismiss the keywords"),
  });

  const refresh = useMutation({
    mutationKey: ["keyword-discovery", id, market, "refresh"],
    mutationFn: () => refreshKeywordDiscoveries(id),
    onSuccess: (result) => {
      toast.success(refreshedToast(result));
      refetch();
    },
    onError: failed("Could not refresh the discoveries"),
  });

  const settings = useMutation({
    mutationKey: ["keyword-discovery", id, market, "settings"],
    mutationFn: (autoTrackRanked: boolean) =>
      setKeywordDiscoverySettings(id, autoTrackRanked),
    onMutate: (autoTrackRanked) => {
      const previous = client.getQueryData<KeywordDiscoveryList>(queryKey);
      if (previous) {
        client.setQueryData(queryKey, { ...previous, autoTrackRanked });
      }
      return { previous };
    },
    onSuccess: (result) => {
      if (result.tracked > 0 || result.skipped > 0) {
        toast.success(trackedToast(result));
      }
      refetch();
    },
    onError: (error, _enabled, context) => {
      if (context?.previous) client.setQueryData(queryKey, context.previous);
      failed("Could not change auto tracking")(error);
    },
  });

  return {
    track,
    trackOnce: useKeyedSingleFlight(track, keyOfTrack),
    dismiss,
    dismissOnce: useKeyedSingleFlight(dismiss, keyOfIds),
    refresh,
    refreshOnce: useSingleFlight(refresh),
    settings,
    settingsOnce: useSingleFlight(settings),
  };
}

export type DiscoveryActions = ReturnType<typeof useDiscoveryActions>;
