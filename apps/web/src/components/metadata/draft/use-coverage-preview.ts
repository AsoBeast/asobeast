"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CoveragePreviewRequest } from "@asobeast/shared";
import type { DraftScope } from "@/lib/listing-draft";
import { coveragePreviewOptions, listingTargetsOptions } from "@/lib/queries";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export const COVERAGE_PREVIEW_DEBOUNCE_MS = 400;

const NO_REQUEST: CoveragePreviewRequest = {};

export function useCoveragePreview(
  appId: string,
  request: CoveragePreviewRequest | null,
) {
  const [settled] = useDebouncedValue(request, COVERAGE_PREVIEW_DEBOUNCE_MS);
  const asked = request === null ? null : settled;
  const query = useQuery({
    ...coveragePreviewOptions(appId, asked ?? NO_REQUEST),
    enabled: asked !== null,
  });
  return {
    query,
    requested: request !== null,
    settling: request !== null && settled !== request,
  };
}

export type CoveragePreview = ReturnType<typeof useCoveragePreview>;

export function useTargetedRequest(
  appId: string,
  scope: DraftScope,
  request: CoveragePreviewRequest | null,
): CoveragePreviewRequest | null {
  const localization = scope.store === "APP_STORE" ? scope.localization : null;
  const targets = useQuery(listingTargetsOptions(appId, localization));
  const targeted = targets.data?.slots.some((slot) => slot !== null) ?? false;
  return useMemo(
    () =>
      request ?? (localization !== null && targeted ? { localization } : null),
    [request, localization, targeted],
  );
}
