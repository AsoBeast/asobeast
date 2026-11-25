import type { PreviewListing } from "@/lib/store-preview/preview-listing";
import type { StorePreviewDevice } from "@/lib/store-preview/store-layouts";

export interface SurfaceProps {
  listing: PreviewListing;
  device: StorePreviewDevice;
}
