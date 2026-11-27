"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { screenshotsOptions } from "@/lib/queries";

export const usePreviewScreenshots = (
  id: string,
  market: string | undefined,
  localization?: string,
) =>
  useQuery({
    ...screenshotsOptions(id, market, localization),
    placeholderData: keepPreviousData,
  });
