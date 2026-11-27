import { describe, expect, it } from "vitest";
import type { SerpEntryItem } from "@asobeast/shared";
import {
  isOutlier,
  keywordInLabel,
  PLACEMENT_LABELS,
} from "./placement-labels";

function entry(over: Partial<SerpEntryItem> = {}): SerpEntryItem {
  return {
    position: 4,
    storeAppId: "rival-store",
    title: "Daily Goals",
    developer: null,
    ratingAvg: null,
    ratingCount: null,
    appId: "comp-1",
    isCompetitor: true,
    ...over,
  };
}

describe("PLACEMENT_LABELS", () => {
  it("names each placement", () => {
    expect(PLACEMENT_LABELS).toEqual({
      title: "Title",
      subtitle: "Subtitle",
      both: "Title and subtitle",
      split: "Split across title and subtitle",
      none: "Neither",
    });
  });
});

describe("keywordInLabel", () => {
  it("names the placement of a judged entry", () => {
    expect(
      keywordInLabel(entry({ placement: "split", subtitle: "x" }), "APP_STORE"),
    ).toEqual({ label: "Split across title and subtitle", note: null });
  });

  it("says when the subtitle is not known", () => {
    expect(keywordInLabel(entry(), "APP_STORE")).toEqual({
      label: "Not in the title",
      note: "subtitle not known",
    });
  });

  it("reads only the title on Google Play", () => {
    expect(
      keywordInLabel(entry({ placement: "title" }), "GOOGLE_PLAY"),
    ).toEqual({ label: "Title", note: null });
    expect(keywordInLabel(entry(), "GOOGLE_PLAY")).toEqual({
      label: "Not in the title",
      note: null,
    });
  });
});

describe("isOutlier", () => {
  const outlier = entry({ placement: "none", subtitle: "Plan your day" });

  it("marks a top 10 competitor without the keyword in either field", () => {
    expect(isOutlier(outlier, "APP_STORE", "competitor")).toBe(true);
    expect(
      isOutlier({ ...outlier, position: 10 }, "APP_STORE", "competitor"),
    ).toBe(true);
  });

  it("never marks your own app, an app you do not follow or a deeper row", () => {
    expect(isOutlier(outlier, "APP_STORE", "you")).toBe(false);
    expect(isOutlier(outlier, "APP_STORE", "other")).toBe(false);
    expect(
      isOutlier({ ...outlier, position: 11 }, "APP_STORE", "competitor"),
    ).toBe(false);
  });

  it("never marks a placement other than none, or a row on Google Play", () => {
    expect(
      isOutlier({ ...outlier, placement: "split" }, "APP_STORE", "competitor"),
    ).toBe(false);
    expect(isOutlier(entry(), "APP_STORE", "competitor")).toBe(false);
    expect(isOutlier(outlier, "GOOGLE_PLAY", "competitor")).toBe(false);
  });
});
