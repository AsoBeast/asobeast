"use client";

import { useState, type ComponentType } from "react";
import type { Store } from "@asobeast/shared";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { storeLabel } from "@/lib/format";
import type { PreviewListing } from "@/lib/store-preview/preview-listing";
import {
  STORE_SURFACES,
  type StorePreviewDevice,
  type StoreSurface,
} from "@/lib/store-preview/store-layouts";
import { AppStoreProductPage } from "./AppStoreProductPage";
import { AppStoreSearchResult } from "./AppStoreSearchResult";
import { PhoneFrame } from "./PhoneFrame";
import { PlayProductPage } from "./PlayProductPage";
import { PlaySearchCard } from "./PlaySearchCard";
import type { SurfaceProps } from "./surface-props";

const SURFACE_LABELS: Record<StoreSurface, string> = {
  search: "Search result",
  product: "Product page",
};

const SURFACES: Record<
  Store,
  Record<StoreSurface, ComponentType<SurfaceProps>>
> = {
  APP_STORE: { search: AppStoreSearchResult, product: AppStoreProductPage },
  GOOGLE_PLAY: { search: PlaySearchCard, product: PlayProductPage },
};

const SOURCE_CAPTIONS = {
  live: "The newest captured listing",
  draft: "Your draft",
} as const;

const isSurface = (value: string): value is StoreSurface =>
  STORE_SURFACES.some((surface) => surface === value);

export const frameLabel = (
  listing: PreviewListing,
  surface: StoreSurface,
): string =>
  `${storeLabel(listing.store)} ${SURFACE_LABELS[surface].toLowerCase()}: ${listing.title || listing.name}`;

export function StorePreview({
  listing,
  source,
}: {
  listing: PreviewListing;
  source: keyof typeof SOURCE_CAPTIONS;
}) {
  const [surface, setSurface] = useState<StoreSurface>("search");
  const device: StorePreviewDevice = "small";
  const Surface = SURFACES[listing.store][surface];
  return (
    <div data-slot="store-preview" className="flex flex-col gap-3">
      <Tabs
        value={surface}
        onValueChange={(next) => {
          if (isSurface(next)) setSurface(next);
        }}
      >
        <TabsList aria-label="Store view">
          {STORE_SURFACES.map((option) => (
            <TabsOption key={option} value={option}>
              {SURFACE_LABELS[option]}
            </TabsOption>
          ))}
        </TabsList>
      </Tabs>
      <PhoneFrame
        store={listing.store}
        device={device}
        label={frameLabel(listing, surface)}
      >
        <Surface listing={listing} device={device} />
      </PhoneFrame>
      <p className="text-caption text-muted-foreground">
        {SOURCE_CAPTIONS[source]}
      </p>
    </div>
  );
}
