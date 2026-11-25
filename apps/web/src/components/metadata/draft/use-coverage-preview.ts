"use client";

import { useQuery } from "@tanstack/react-query";
import type { CoveragePreviewRequest } from "@asobeast/shared";
import { coveragePreviewOptions } from "@/lib/queries";
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
