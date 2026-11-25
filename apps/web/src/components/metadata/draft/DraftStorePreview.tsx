"use client";

import { useDeferredValue, useId } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMarket } from "@/components/app-detail/use-market";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { StorePreviewSkeleton } from "@/components/overview/skeletons";
import { StorePreview } from "@/components/store-preview/StorePreview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ListingDraftValues } from "@/lib/listing-draft";
import { queryMarket } from "@/lib/market";
import { appDetailOptions, screenshotsOptions } from "@/lib/queries";
import { previewListingOf } from "@/lib/store-preview/preview-listing";

export function DraftStorePreview({
  id,
  values,
  localization,
  className,
}: {
  id: string;
  values: ListingDraftValues;
  localization: string | undefined;
  className?: string;
}) {
  const headingId = useId();
  const { market, home } = useMarket(id);
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const screenshots = useQuery(
    screenshotsOptions(id, queryMarket(market, home), localization),
  );
  const drafted = useDeferredValue(values);

  return (
    <section aria-labelledby={headingId} className={className}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>In the store</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {screenshots.isPending ? (
            <StorePreviewSkeleton />
          ) : (
            <StorePreview
              listing={previewListingOf({
                detail,
                screenshots: screenshots.data ?? null,
                draft: drafted,
              })}
              source="draft"
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
