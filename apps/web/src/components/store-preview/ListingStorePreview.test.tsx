import { renderToStaticMarkup } from "react-dom/server";
import type { UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { AppDetail, AppScreenshots } from "@asobeast/shared";
import { ListingStorePreview } from "./ListingStorePreview";

const detail: AppDetail = {
  id: "app-1",
  store: "APP_STORE",
  storeAppId: "123",
  country: "us",
  name: "Focus Timer",
  iconUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  searchable: true,
  latestSnapshot: null,
  competitors: [],
  group: null,
};

const screenshots: AppScreenshots = {
  appId: "app-1",
  store: "APP_STORE",
  snapshotId: "snap-1",
  capturedAt: "2026-11-24T06:00:00.000Z",
  reading: "on",
  screenshots: [
    {
      position: 1,
      url: "https://is1-ssl.mzstatic.com/shot-1.png",
      caption: null,
      status: "read",
    },
  ],
};

interface ReadState {
  data?: AppScreenshots;
  isPending?: boolean;
  isFetching?: boolean;
  errorUpdatedAt?: number;
  isPlaceholderData?: boolean;
  isError?: boolean;
}

const read = (state: ReadState): UseQueryResult<AppScreenshots> =>
  ({
    isPending: false,
    isError: false,
    isPlaceholderData: false,
    isFetching: false,
    refetch: () => Promise.resolve(),
    ...state,
  }) as unknown as UseQueryResult<AppScreenshots>;

const markupOf = (state: ReadState) =>
  renderToStaticMarkup(
    <ListingStorePreview
      detail={detail}
      screenshots={read(state)}
      source="live"
    />,
  );

describe("ListingStorePreview", () => {
  it("draws the screenshots of the listing on screen", () => {
    expect(markupOf({ data: screenshots })).toContain(
      'data-slot="store-preview-screenshots"',
    );
  });

  it("hides another listing's screenshots while its own load", () => {
    const markup = markupOf({ data: screenshots, isPlaceholderData: true });
    expect(markup).toContain('data-slot="store-preview-frame"');
    expect(markup).not.toContain('data-slot="store-preview-screenshots"');
    expect(markup).not.toContain("No screenshots captured yet");
  });

  it("says when the screenshots of the listing cannot be read", () => {
    const markup = markupOf({
      data: screenshots,
      isPlaceholderData: true,
      isError: true,
    });
    expect(markup).toContain("Could not read the screenshots of this listing.");
    expect(markup).not.toContain('data-slot="store-preview-screenshots"');
  });

  it("keeps the read error and its retry while a retry runs", () => {
    const markup = markupOf({
      isPending: true,
      isFetching: true,
      errorUpdatedAt: 1,
    });
    expect(markup).toContain("Could not read the screenshots of this listing.");
    expect(markup).toContain('data-slot="store-preview-frame"');
  });
});
