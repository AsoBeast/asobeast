"use client";

import { Suspense } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMarket } from "@/components/app-detail/use-market";
import { CollapsedSectionsProvider } from "@/components/layout/CollapsedSections";
import { CollapsibleCard } from "@/components/layout/CollapsibleCard";
import { KNOWN_SECTIONS } from "@/components/layout/known-sections";
import { StorePreview } from "@/components/store-preview/StorePreview";
import { queryMarket } from "@/lib/market";
import { appListingOptions, screenshotsOptions } from "@/lib/queries";
import { previewListingOf } from "@/lib/store-preview/preview-listing";
import { OVERVIEW_SECTION } from "./overview-sections";
import { StorePreviewSkeleton } from "./skeletons";

function LiveStorePreview({ id }: { id: string }) {
  const { market, home } = useMarket(id);
  const country = queryMarket(market, home);
  const { data: detail } = useSuspenseQuery(appListingOptions(id, country));
  const screenshots = useQuery(screenshotsOptions(id, country));
  if (screenshots.isPending) return <StorePreviewSkeleton />;
  return (
    <StorePreview
      listing={previewListingOf({
        detail,
        screenshots: screenshots.data ?? null,
      })}
      source="live"
    />
  );
}

export function StorePreviewCard({
  id,
  collapsed,
}: {
  id: string;
  collapsed: readonly string[];
}) {
  return (
    <CollapsedSectionsProvider initial={collapsed} known={KNOWN_SECTIONS}>
      <CollapsibleCard
        section={OVERVIEW_SECTION.storePreview}
        title="In the store"
      >
        <Suspense fallback={<StorePreviewSkeleton />}>
          <LiveStorePreview id={id} />
        </Suspense>
      </CollapsibleCard>
    </CollapsedSectionsProvider>
  );
}
