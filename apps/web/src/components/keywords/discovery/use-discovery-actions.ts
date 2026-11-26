"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type {
  KeywordDiscoveryList,
  KeywordDiscoveryTrackRequest,
} from "@asobeast/shared";
import {
  dismissKeywordDiscoveries,
  refreshKeywordDiscoveries,
  setKeywordDiscoverySettings,
  trackKeywordDiscoveries,
  apiErrorMessage,
} from "@/lib/api";
import {
  refreshedToast,
  trackedToast,
  withoutDiscoveries,
} from "@/lib/keyword-discoveries";
import {
  invalidateKeywordDiscoveries,
  invalidateKeywordMutation,
  keywordDiscoveriesOptions,
} from "@/lib/queries";
import { useKeyedSingleFlight, useSingleFlight } from "@/lib/single-flight";

export interface DiscoveryTrack {
  request: KeywordDiscoveryTrackRequest;
  removes: readonly string[];
}

const keyOfIds = (ids: readonly string[]): string => JSON.stringify(ids);

const keyOfTrack = ({ request, removes }: DiscoveryTrack): string =>
  JSON.stringify([request.allRanked ?? false, removes]);

export function useDiscoveryActions(
  id: string,
  market: string,
  onTracked: () => void,
) {
  const client = useQueryClient();
  const t = useTranslations("keywordInspector");
  const failed = (fallback: string) => (error: unknown) =>
    toast.error(apiErrorMessage(error, t(fallback)));
  const { queryKey } = keywordDiscoveriesOptions(id, market);
  const removeRows = (ids: readonly string[]) =>
    client.setQueryData<KeywordDiscoveryList>(queryKey, (list) =>
      list ? withoutDiscoveries(list, ids) : list,
    );
  const refetchTracked = () => invalidateKeywordMutation(client, id);
  const refetchDiscoveries = () => invalidateKeywordDiscoveries(client, id);
  const setAutoTrack = (autoTrackRanked: boolean) =>
    client.setQueryData<KeywordDiscoveryList>(queryKey, (list) =>
      list ? { ...list, autoTrackRanked } : list,
    );

  const track = useMutation({
    mutationKey: ["keyword-discovery", id, market, "track"],
    mutationFn: ({ request }: DiscoveryTrack) =>
      trackKeywordDiscoveries(id, request),
    onSuccess: (result, { removes }) => {
      if (result.skipped === 0) removeRows(removes);
      onTracked();
      toast.success(trackedToast(result, t));
      refetchTracked();
    },
    onError: failed("discovery.toast.trackFailed"),
  });

  const dismiss = useMutation({
    mutationKey: ["keyword-discovery", id, market, "dismiss"],
    mutationFn: (ids: readonly string[]) =>
      dismissKeywordDiscoveries(id, [...ids]),
    onSuccess: (_result, ids) => {
      removeRows(ids);
      refetchDiscoveries();
    },
    onError: failed("discovery.toast.dismissFailed"),
  });

  const refresh = useMutation({
    mutationKey: ["keyword-discovery", id, market, "refresh"],
    mutationFn: () => refreshKeywordDiscoveries(id),
    onSuccess: (result) => {
      toast.success(refreshedToast(result, t));
      const autoTracks =
        client.getQueryData<KeywordDiscoveryList>(queryKey)?.autoTrackRanked;
      if (autoTracks) refetchTracked();
      else refetchDiscoveries();
    },
    onError: failed("discovery.toast.refreshFailed"),
  });

  const settings = useMutation({
    mutationKey: ["keyword-discovery", id, market, "settings"],
    mutationFn: (autoTrackRanked: boolean) =>
      setKeywordDiscoverySettings(id, autoTrackRanked),
    onMutate: (autoTrackRanked) => setAutoTrack(autoTrackRanked),
    onSuccess: (result) => {
      if (result.tracked === 0 && result.skipped === 0) {
        refetchDiscoveries();
        return;
      }
      toast.success(trackedToast(result, t));
      refetchTracked();
    },
    onError: (error, enabled) => {
      setAutoTrack(!enabled);
      refetchDiscoveries();
      failed("discovery.toast.settingsFailed")(error);
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
