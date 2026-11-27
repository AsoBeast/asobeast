import { AppIcon } from "@/components/AppIcon";
import {
  STORE_SCREEN_WIDTHS,
  STORE_TEXT_LAYOUTS,
} from "@/lib/store-preview/store-layouts";
import { CutText } from "./CutText";
import { DeveloperLine } from "./DeveloperLine";
import { RatingLine } from "./RatingLine";
import { ScreenshotRow } from "./ScreenshotRow";
import { StoreButton } from "./StoreButton";
import type { SurfaceProps } from "./surface-props";

const LAYOUT = STORE_TEXT_LAYOUTS.GOOGLE_PLAY.product;

export function PlayProductPage({ listing, device, measure }: SurfaceProps) {
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="flex items-start gap-4">
        <AppIcon src={listing.iconUrl} size={72} />
        <div className="flex min-w-0 flex-col gap-1">
          <CutText
            text={listing.title}
            layout={LAYOUT.title}
            device={device}
            measure={measure}
          />
          <DeveloperLine developer={listing.developer} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <RatingLine rating={listing.rating} />
        <StoreButton label="Install" />
      </div>
      {listing.shortDescription ? (
        <CutText
          text={listing.shortDescription}
          layout={LAYOUT.shortDescription}
          device={device}
          measure={measure}
        />
      ) : null}
      <ScreenshotRow
        screenshots={listing.screenshots}
        screenWidth={STORE_SCREEN_WIDTHS.GOOGLE_PLAY[device]}
      />
    </div>
  );
}
