import { AppIcon } from "@/components/AppIcon";
import {
  STORE_SCREEN_WIDTHS,
  STORE_TEXT_LAYOUTS,
} from "@/lib/store-preview/store-layouts";
import { CutText } from "./CutText";
import { RatingLine } from "./RatingLine";
import { ScreenshotRow } from "./ScreenshotRow";
import { StoreButton } from "./StoreButton";
import type { SurfaceProps } from "./surface-props";

const LAYOUT = STORE_TEXT_LAYOUTS.APP_STORE.search;

export function AppStoreSearchResult({
  listing,
  device,
  measure,
}: SurfaceProps) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-center gap-3">
        <AppIcon src={listing.iconUrl} size={64} />
        <div className="flex flex-col gap-1">
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
          <RatingLine rating={listing.rating} />
        </div>
        <StoreButton label="Get" />
      </div>
      <ScreenshotRow
        screenshots={listing.screenshots}
        screenWidth={STORE_SCREEN_WIDTHS.APP_STORE[device]}
      />
    </div>
  );
}
