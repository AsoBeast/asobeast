"use client";

import { useDeferredValue, useId } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMarket } from "@/components/app-detail/use-market";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { ListingStorePreview } from "@/components/store-preview/ListingStorePreview";
import { usePreviewScreenshots } from "@/components/store-preview/use-preview-screenshots";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ListingDraftValues } from "@/lib/listing-draft";
import { queryMarket } from "@/lib/market";
import { appDetailOptions, appListingOptions } from "@/lib/queries";

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
  const country = queryMarket(market, home);
  const { data: homeDetail } = useSuspenseQuery(appDetailOptions(id));
  const { data: marketDetail } = useQuery({
    ...appListingOptions(id, country),
    retry: false,
  });
  const screenshots = usePreviewScreenshots(id, country, localization);
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
          <ListingStorePreview
            detail={marketDetail ?? homeDetail}
            screenshots={screenshots}
            draft={drafted}
            source="draft"
          />
        </CardContent>
      </Card>
    </section>
  );
}
