import { AppIcon } from "@/components/AppIcon";
import { productPageText } from "@/lib/store-preview/preview-listing";
import {
  STORE_SCREEN_WIDTHS,
  STORE_TEXT_LAYOUTS,
} from "@/lib/store-preview/store-layouts";
import { CutText } from "./CutText";
import { RatingLine } from "./RatingLine";
import { ScreenshotRow } from "./ScreenshotRow";
import { StoreButton } from "./StoreButton";
import type { SurfaceProps } from "./surface-props";

const LAYOUT = STORE_TEXT_LAYOUTS.APP_STORE.product;

export function AppStoreProductPage({
  listing,
  device,
  measure,
}: SurfaceProps) {
  const text = productPageText(listing);
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex gap-4">
        <AppIcon src={listing.iconUrl} size={118} />
        <div className="flex flex-col items-start gap-1">
          <CutText
            text={listing.title}
            layout={LAYOUT.title}
            device={device}
            measure={measure}
          />
          {listing.subtitle ? (
            <CutText
              text={listing.subtitle}
              layout={LAYOUT.subtitle}
              device={device}
              measure={measure}
              className="text-muted-foreground"
            />
          ) : null}
          <span className="mt-auto">
            <StoreButton label="Get" />
          </span>
        </div>
      </div>
      <RatingLine rating={listing.rating} />
      {text ? (
        <p dir="auto" className="line-clamp-3 text-dense whitespace-pre-line">
          {text}
        </p>
      ) : null}
      <ScreenshotRow
        screenshots={listing.screenshots}
        screenWidth={STORE_SCREEN_WIDTHS.APP_STORE[device]}
      />
    </div>
  );
}
