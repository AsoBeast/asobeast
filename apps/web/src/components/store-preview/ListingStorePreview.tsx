import type { UseQueryResult } from "@tanstack/react-query";
import type { AppDetail, AppScreenshots } from "@asobeast/shared";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import type { ListingDraftValues } from "@/lib/listing-draft";
import { previewListingOf } from "@/lib/store-preview/preview-listing";
import { StorePreview, type PreviewSource } from "./StorePreview";
import { StorePreviewSkeleton } from "./StorePreviewSkeleton";

export function ListingStorePreview({
  detail,
  screenshots,
  draft,
  source,
}: {
  detail: AppDetail;
  screenshots: UseQueryResult<AppScreenshots>;
  draft?: ListingDraftValues;
  source: PreviewSource;
}) {
  const failed = failedRead(screenshots);
  if (screenshots.isPending && !failed) return <StorePreviewSkeleton />;
  const current = screenshots.isPlaceholderData ? undefined : screenshots.data;
  const unread = (screenshots.isError || failed) && current === undefined;
  return (
    <div className="flex flex-col gap-3">
      {unread ? (
        <InlineQueryError
          message="Could not read the screenshots of this listing."
          read={screenshots}
        />
      ) : null}
      <StorePreview
        listing={previewListingOf({
          detail,
          screenshots: current ?? null,
          draft,
        })}
        source={source}
      />
    </div>
  );
}
