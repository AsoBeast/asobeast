"use client";

import { useCallback, useMemo } from "react";
import { useStoredPreference } from "@/lib/use-stored-preference";
import {
  DEFAULT_ZONE_THRESHOLDS,
  isDefaultThresholds,
  parseZoneThresholds,
  serializeZoneThresholds,
  ZONE_THRESHOLDS_KEY,
  type ZoneThresholds,
} from "@/lib/keyword-zones";
import { keywordColumnFilters, type KeywordFilters } from "./keyword-filters";

export function useZoneThresholds() {
  const [raw, save] = useStoredPreference(ZONE_THRESHOLDS_KEY);
  const thresholds = useMemo(() => parseZoneThresholds(raw), [raw]);
  const setThresholds = useCallback(
    (next: ZoneThresholds) => save(serializeZoneThresholds(next)),
    [save],
  );
  const resetThresholds = useCallback(
    () => save(serializeZoneThresholds(DEFAULT_ZONE_THRESHOLDS)),
    [save],
  );
  return {
    thresholds,
    setThresholds,
    resetThresholds,
    isDefault: isDefaultThresholds(thresholds),
  };
}

export function useKeywordColumnFilters(filters: KeywordFilters) {
  const { thresholds } = useZoneThresholds();
  return useMemo(
    () => keywordColumnFilters(filters, thresholds),
    [filters, thresholds],
  );
}
