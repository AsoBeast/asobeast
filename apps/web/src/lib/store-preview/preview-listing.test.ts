import { describe, expect, it } from "vitest";
import type {
  AppDetail,
  AppScreenshots,
  AppSnapshotDetail,
  ScreenshotItem,
} from "@asobeast/shared";
import { previewListingOf, productPageText } from "./preview-listing";

const snapshot: AppSnapshotDetail = {
  id: "snap-1",
  title: "Focus Timer",
  subtitle: "Pomodoro and deep work",
  summary: "Stay on task",
  ratingAvg: 4.62,
  ratingCount: 12840,
  installs: null,
  price: 0,
  version: "2.4.0",
  capturedAt: "2026-11-24T06:00:00.000Z",
  developer: "Calm Labs",
  description: "Plan your day in focused blocks.",
};

const detail = (overrides: Partial<AppDetail> = {}): AppDetail => ({
  id: "app-1",
  store: "APP_STORE",
  storeAppId: "123",
  country: "us",
  name: "Focus Timer",
  iconUrl: "https://is1-ssl.mzstatic.com/icon.png",
  createdAt: "2026-01-01T00:00:00.000Z",
  searchable: true,
  latestSnapshot: snapshot,
  competitors: [],
  group: null,
  ...overrides,
});

const shot = (position: number): ScreenshotItem => ({
  position,
  url: `https://is1-ssl.mzstatic.com/shot-${position}.png`,
  caption: null,
  status: "read",
});

const screenshots = (positions: number[]): AppScreenshots => ({
  appId: "app-1",
  store: "APP_STORE",
  snapshotId: "snap-1",
  capturedAt: "2026-11-24T06:00:00.000Z",
  reading: "on",
  screenshots: positions.map(shot),
});

describe("previewListingOf", () => {
  it("reads title, subtitle, rating and developer from the live listing", () => {
    expect(previewListingOf({ detail: detail(), screenshots: null })).toEqual({
      store: "APP_STORE",
      name: "Focus Timer",
      iconUrl: "https://is1-ssl.mzstatic.com/icon.png",
      title: "Focus Timer",
      subtitle: "Pomodoro and deep work",
      shortDescription: null,
      promotionalText: null,
      description: "Plan your day in focused blocks.",
      developer: "Calm Labs",
      rating: { average: 4.62, count: 12840 },
      screenshots: [],
    });
  });

  it("uses the short description on Google Play and no subtitle", () => {
    const listing = previewListingOf({
      detail: detail({ store: "GOOGLE_PLAY" }),
      screenshots: null,
    });
    expect(listing.subtitle).toBeNull();
    expect(listing.shortDescription).toBe("Stay on task");
  });

  it("takes the first three screenshots in position order", () => {
    const listing = previewListingOf({
      detail: detail(),
      screenshots: screenshots([4, 2, 1, 5, 3]),
    });
    expect(listing.screenshots.map((item) => item.position)).toEqual([1, 2, 3]);
  });

  it("puts the draft over the live values field by field", () => {
    const listing = previewListingOf({
      detail: detail(),
      screenshots: null,
      draft: { title: "Focus Timer: Deep Work" },
    });
    expect(listing.title).toBe("Focus Timer: Deep Work");
    expect(listing.subtitle).toBe("Pomodoro and deep work");
  });

  it("drops a field the draft empties", () => {
    const listing = previewListingOf({
      detail: detail(),
      screenshots: null,
      draft: { subtitle: "  " },
    });
    expect(listing.subtitle).toBeNull();
  });

  it("answers no rating when the store shows none", () => {
    const listing = previewListingOf({
      detail: detail({
        latestSnapshot: { ...snapshot, ratingAvg: null, ratingCount: null },
      }),
      screenshots: null,
    });
    expect(listing.rating).toBeNull();
  });

  it("falls back to the app name before the first capture", () => {
    const listing = previewListingOf({
      detail: detail({ latestSnapshot: null }),
      screenshots: null,
    });
    expect(listing).toMatchObject({
      title: "Focus Timer",
      subtitle: null,
      description: "",
      rating: null,
    });
  });
});

describe("productPageText", () => {
  it("opens the product page text with the promotional text when the draft has one, else the description", () => {
    const live = previewListingOf({ detail: detail(), screenshots: null });
    const drafted = previewListingOf({
      detail: detail(),
      screenshots: null,
      draft: { promotionalText: "New: focus streaks" },
    });
    expect(productPageText(live)).toBe("Plan your day in focused blocks.");
    expect(productPageText(drafted)).toBe("New: focus streaks");
  });

  it("keeps promotional text off Google Play", () => {
    const listing = previewListingOf({
      detail: detail({ store: "GOOGLE_PLAY" }),
      screenshots: null,
      draft: { promotionalText: "New: focus streaks" },
    });
    expect(listing.promotionalText).toBeNull();
  });
});
