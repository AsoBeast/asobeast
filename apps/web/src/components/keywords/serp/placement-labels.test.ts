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

  it("names each placement on Google Play", () => {
    const labelOf = (placement: SerpEntryItem["placement"]) =>
      keywordInLabel(
        entry({ placement, shortDescription: "Plan your day" }),
        "GOOGLE_PLAY",
      );

    expect(labelOf("title")).toEqual({ label: "Title", note: null });
    expect(labelOf("subtitle")).toEqual({
      label: "Short description",
      note: null,
    });
    expect(labelOf("both")).toEqual({
      label: "Title and short description",
      note: null,
    });
    expect(labelOf("split")).toEqual({
      label: "Split across title and short description",
      note: null,
    });
    expect(labelOf("none")).toEqual({ label: "Neither", note: null });
  });

  it("says when the short description is not known on Google Play", () => {
    expect(keywordInLabel(entry(), "GOOGLE_PLAY")).toEqual({
      label: "Not in the title",
      note: "short description not known",
    });
    expect(
      keywordInLabel(entry({ placement: "title" }), "GOOGLE_PLAY"),
    ).toEqual({ label: "Title", note: null });
  });

  it("ignores a subtitle on Google Play", () => {
    expect(keywordInLabel(entry({ subtitle: "x" }), "GOOGLE_PLAY").note).toBe(
      "short description not known",
    );
  });
});

describe("isOutlier", () => {
  const outlier = entry({ placement: "none" });

  it("marks a top 10 competitor without the keyword in either field", () => {
    expect(isOutlier(outlier, "competitor")).toBe(true);
    expect(isOutlier({ ...outlier, position: 10 }, "competitor")).toBe(true);
  });

  it("never marks your own app, an app you do not follow or a deeper row", () => {
    expect(isOutlier(outlier, "you")).toBe(false);
    expect(isOutlier(outlier, "other")).toBe(false);
    expect(isOutlier({ ...outlier, position: 11 }, "competitor")).toBe(false);
  });

  it("never marks a placement other than none or an unjudged row", () => {
    expect(isOutlier({ ...outlier, placement: "split" }, "competitor")).toBe(
      false,
    );
    expect(isOutlier(entry(), "competitor")).toBe(false);
  });
});
