import type { AppListItem, ChartAppLink } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  candidateApps,
  captureErrorText,
  followErrorText,
  rowLink,
  storeUrl,
} from "./chart-actions";

const refused = (statusCode: number, message: string) =>
  new ApiError({
    statusCode,
    error: "Refused",
    message,
    path: "/charts",
    timestamp: "2026-10-15T00:00:00.000Z",
  });

const LINK: ChartAppLink = {
  storeAppId: "1",
  appId: "app-1",
  primaryAppId: null,
  name: "Focus Timer",
  role: "own",
};

describe("storeUrl", () => {
  it("opens the listing in the chart's storefront", () => {
    expect(storeUrl("APP_STORE", "123", "de")).toBe(
      "https://apps.apple.com/de/app/id123",
    );
    expect(storeUrl("GOOGLE_PLAY", "com.example.app", "de")).toBe(
      "https://play.google.com/store/apps/details?id=com.example.app&gl=de",
    );
  });
});

describe("rowLink", () => {
  it("links the workspace's own app to its overview", () => {
    expect(rowLink(LINK)).toEqual({
      href: "/apps/app-1",
      label: "Yours",
      role: "own",
    });
  });

  it("links a competitor to the competitors of the app it competes with", () => {
    expect(
      rowLink({
        ...LINK,
        appId: "rival",
        primaryAppId: "app-1",
        role: "competitor",
      }),
    ).toEqual({
      href: "/apps/app-1/competitors",
      label: "Competitor of Focus Timer",
      role: "competitor",
    });
  });

  it("names an unnamed app as yours", () => {
    expect(
      rowLink({
        ...LINK,
        primaryAppId: "app-1",
        role: "competitor",
        name: null,
      })?.label,
    ).toBe("Competitor of your app");
  });

  it("links nothing for a row the workspace does not track", () => {
    expect(rowLink(undefined)).toBeNull();
  });
});

describe("candidateApps", () => {
  it("offers the apps on the chart's store", () => {
    const apps = [
      { id: "a", store: "APP_STORE" },
      { id: "b", store: "GOOGLE_PLAY" },
    ] as AppListItem[];

    expect(candidateApps(apps, "GOOGLE_PLAY").map((app) => app.id)).toEqual([
      "b",
    ]);
  });
});

describe("error texts", () => {
  it("passes a spent allowance through and words a store failure", () => {
    expect(captureErrorText(refused(429, "Chart capture limit reached"))).toBe(
      "Chart capture limit reached",
    );
    expect(captureErrorText(refused(502, "upstream"))).toBe(
      "The store did not answer. Try again in a moment.",
    );
    expect(captureErrorText(new Error("network"))).toBe(
      "Could not capture the chart.",
    );
  });

  it("passes a full quota through", () => {
    expect(followErrorText(refused(403, "The indie plan allows 10"))).toBe(
      "The indie plan allows 10",
    );
    expect(followErrorText(refused(500, "boom"))).toBe(
      "Could not follow the chart.",
    );
  });
});
