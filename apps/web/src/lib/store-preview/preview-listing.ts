import type {
  AppDetail,
  AppScreenshots,
  AppSnapshotDetail,
  ScreenshotItem,
  Store,
} from "@asobeast/shared";
import type { ListingDraftValues } from "../listing-draft";

export const PREVIEW_SCREENSHOTS = 3;

export interface PreviewRating {
  average: number;
  count: number;
}

export interface PreviewListing {
  store: Store;
  name: string;
  iconUrl: string | null;
  title: string;
  subtitle: string | null;
  shortDescription: string | null;
  promotionalText: string | null;
  description: string;
  developer: string | null;
  rating: PreviewRating | null;
  screenshots: readonly ScreenshotItem[] | null;
}

const shownText = (
  drafted: string | undefined,
  live: string | null | undefined,
): string | null => {
  const text = drafted ?? live ?? "";
  return text.trim() === "" ? null : text;
};

const firstScreenshots = (
  screenshots: AppScreenshots | null,
): ScreenshotItem[] | null =>
  screenshots &&
  [...screenshots.screenshots]
    .sort((left, right) => left.position - right.position)
    .slice(0, PREVIEW_SCREENSHOTS);

const ratingOf = (snapshot: AppSnapshotDetail | null): PreviewRating | null =>
  snapshot && typeof snapshot.ratingAvg === "number"
    ? { average: snapshot.ratingAvg, count: snapshot.ratingCount ?? 0 }
    : null;

function storeFields(
  store: Store,
  snapshot: AppSnapshotDetail | null,
  draft: ListingDraftValues,
): Pick<PreviewListing, "subtitle" | "shortDescription" | "promotionalText"> {
  if (store === "GOOGLE_PLAY") {
    return {
      subtitle: null,
      shortDescription: shownText(draft.shortDescription, snapshot?.summary),
      promotionalText: null,
    };
  }
  return {
    subtitle: shownText(draft.subtitle, snapshot?.subtitle),
    shortDescription: null,
    promotionalText: shownText(draft.promotionalText, null),
  };
}

export function previewListingOf({
  detail,
  screenshots,
  draft = {},
}: {
  detail: AppDetail;
  screenshots: AppScreenshots | null;
  draft?: ListingDraftValues;
}): PreviewListing {
  const snapshot = detail.latestSnapshot;
  const name = detail.name ?? snapshot?.title ?? "";
  return {
    store: detail.store,
    name,
    iconUrl: detail.iconUrl,
    title: draft.title ?? snapshot?.title ?? name,
    ...storeFields(detail.store, snapshot, draft),
    description: draft.description ?? snapshot?.description ?? "",
    developer: snapshot?.developer ?? null,
    rating: ratingOf(snapshot),
    screenshots: firstScreenshots(screenshots),
  };
}

export const productPageText = (listing: PreviewListing): string =>
  listing.promotionalText ?? listing.description;
