"use client";

import { useState, type ComponentType } from "react";
import type { Store } from "@asobeast/shared";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { storeLabel } from "@/lib/format";
import { cutSentences } from "@/lib/store-preview/cut-sentence";
import type { PreviewListing } from "@/lib/store-preview/preview-listing";
import {
  DEVICE_LABELS,
  STORE_PREVIEW_DEVICES,
  STORE_SURFACES,
  type StorePreviewDevice,
  type StoreSurface,
} from "@/lib/store-preview/store-layouts";
import { AppStoreProductPage } from "./AppStoreProductPage";
import { AppStoreSearchResult } from "./AppStoreSearchResult";
import { CutNotes } from "./CutNotes";
import { PhoneFrame } from "./PhoneFrame";
import { PlayProductPage } from "./PlayProductPage";
import { PlaySearchCard } from "./PlaySearchCard";
import type { SurfaceProps } from "./surface-props";
import { useTextMeasure } from "./use-text-measure";

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

export const frameLabel = (
  listing: PreviewListing,
  surface: StoreSurface,
): string =>
  `${storeLabel(listing.store)} ${SURFACE_LABELS[surface].toLowerCase()}: ${listing.title || listing.name}`;

function OptionStrip<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const chosen = options.find((option) => option === next);
        if (chosen) onChange(chosen);
      }}
    >
      <TabsList aria-label={label}>
        {options.map((option) => (
          <TabsOption key={option} value={option}>
            {labels[option]}
          </TabsOption>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function StorePreview({
  listing,
  source,
}: {
  listing: PreviewListing;
  source: keyof typeof SOURCE_CAPTIONS;
}) {
  const [surface, setSurface] = useState<StoreSurface>("search");
  const [device, setDevice] = useState<StorePreviewDevice>("small");
  const measure = useTextMeasure();
  const Surface = SURFACES[listing.store][surface];
  const cuts = measure ? cutSentences(listing, surface, device, measure) : [];
  return (
    <div data-slot="store-preview" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <OptionStrip
          label="Store view"
          options={STORE_SURFACES}
          labels={SURFACE_LABELS}
          value={surface}
          onChange={setSurface}
        />
        <OptionStrip
          label="Phone size"
          options={STORE_PREVIEW_DEVICES}
          labels={DEVICE_LABELS[listing.store]}
          value={device}
          onChange={setDevice}
        />
      </div>
      <PhoneFrame
        store={listing.store}
        device={device}
        label={frameLabel(listing, surface)}
      >
        <Surface listing={listing} device={device} measure={measure} />
      </PhoneFrame>
      <CutNotes cuts={cuts} />
      <p className="text-caption text-muted-foreground">
        {SOURCE_CAPTIONS[source]}
      </p>
    </div>
  );
}
