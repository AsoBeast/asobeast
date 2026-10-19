import {
  PLAN_LIMITS,
  SELF_HOSTED_LIMITS,
  type AppListItem,
  type ChartAppLink,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  candidateApps,
  captureCostText,
  captureErrorText,
  competitorFocusKey,
  emptyChartBody,
  followErrorText,
  noAppsBody,
  noAppsToast,
  rowContextOf,
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
      "Could not follow the category.",
    );
  });
});

describe("rowContextOf", () => {
  it("indexes the page's app links by store id", () => {
    const context = rowContextOf(
      {
        chart: {
          store: "APP_STORE",
          country: "us",
          collection: "free",
          genre: "6014",
          device: "iphone",
          genreName: "Games",
        },
        apps: [
          {
            storeAppId: "111",
            appId: "app-1",
            primaryAppId: null,
            name: "Focus Timer",
            role: "own",
          },
        ],
      },
      [],
    );

    expect(context.links.get("111")?.appId).toBe("app-1");
    expect(context.links.get("222")).toBeUndefined();
    expect(context.chart.country).toBe("us");
  });
});

describe("captureCostText", () => {
  it("names the plan's daily captures", () => {
    expect(captureCostText(PLAN_LIMITS.indie)).toBe(
      "Capture today spends one of the 30 chart captures your plan allows a day.",
    );
  });

  it("says a self hosted capture reaches the store once", () => {
    expect(captureCostText(SELF_HOSTED_LIMITS)).toBe(
      "Capture today reaches the store once and stores the chart for every workspace.",
    );
  });

  it("says a plan without captures has none", () => {
    expect(captureCostText(PLAN_LIMITS.free)).toBe(
      "Your plan includes no chart captures.",
    );
  });

  it("names no number before the plan has loaded", () => {
    expect(captureCostText(undefined)).toBe(
      "Capture today reaches the store once.",
    );
  });
});

describe("emptyChartBody", () => {
  it("offers a capture and names its cost", () => {
    expect(emptyChartBody(true, PLAN_LIMITS.indie)).toBe(
      "Pick a captured day, or capture today. Capture today spends one of the 30 chart captures your plan allows a day.",
    );
    expect(emptyChartBody(false, SELF_HOSTED_LIMITS)).toBe(
      "Capture it now, or follow the category so the daily run keeps it. Capture today reaches the store once and stores the chart for every workspace.",
    );
  });

  it("offers no capture on a plan without captures", () => {
    expect(emptyChartBody(true, PLAN_LIMITS.free)).toBe(
      "Pick a captured day. Your plan includes no chart captures.",
    );
    expect(emptyChartBody(false, PLAN_LIMITS.free)).toBe(
      "Follow the category so the daily run keeps it. Your plan includes no chart captures.",
    );
  });

  it("offers a capture before the plan has loaded", () => {
    expect(emptyChartBody(false, undefined)).toBe(
      "Capture it now, or follow the category so the daily run keeps it. Capture today reaches the store once.",
    );
  });
});

describe("no apps wording", () => {
  it("names the store, the category and the day", () => {
    expect(
      noAppsBody({ store: "GOOGLE_PLAY", genreName: "Shopping" }, "2026-10-16"),
    ).toBe(
      "Google Play listed no apps in Shopping on Oct 16, 2026. A category can have no apps of one kind, such as paid apps.",
    );
  });

  it("toasts the store that lists no apps today", () => {
    expect(noAppsToast("APP_STORE")).toBe(
      "App Store lists no apps in this chart today",
    );
  });
});

describe("competitorFocusKey", () => {
  it("names the claim after the chart app", () => {
    expect(competitorFocusKey("6400000001")).toBe("competitor:6400000001");
  });
});
