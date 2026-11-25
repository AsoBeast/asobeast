import { AppIcon } from "@/components/AppIcon";
import { STORE_TEXT_LAYOUTS } from "@/lib/store-preview/store-layouts";
import { CutText } from "./CutText";
import { RatingLine } from "./RatingLine";
import type { SurfaceProps } from "./surface-props";

const LAYOUT = STORE_TEXT_LAYOUTS.GOOGLE_PLAY.search;

export function PlaySearchCard({ listing, device, measure }: SurfaceProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-4">
      <AppIcon src={listing.iconUrl} size={56} />
      <div className="flex flex-col gap-1">
        <CutText
          text={listing.title}
          layout={LAYOUT.title}
          device={device}
          measure={measure}
        />
        {listing.developer ? (
          <span dir="auto" className="text-caption text-muted-foreground">
            {listing.developer}
          </span>
        ) : null}
        <RatingLine rating={listing.rating} />
      </div>
    </div>
  );
}
