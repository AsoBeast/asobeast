import { describe, expect, it } from "vitest";
import type { ChangeEventItem } from "@asobeast/shared";
import {
  hasScreenshotDetail,
  screenshotChangeSummary,
} from "./screenshot-change";

const base: Omit<ChangeEventItem, "field" | "before" | "after"> = {
  id: "e1",
  appId: "a1",
  appName: "Focus Timer",
  isCompetitor: false,
  capturedAt: "2026-10-07T03:00:00.000Z",
};

const images = (
  field: ChangeEventItem["field"],
  detail: { added: number[]; removed: number[]; reordered: boolean },
): ChangeEventItem => ({
  ...base,
  field,
  before: "3 screenshots",
  after: "3 screenshots, 1 replaced",
  detail: {
    kind: "images",
    before: [{ position: 1, url: "https://x/a" }],
    after: [{ position: 1, url: "https://x/b" }],
    ...detail,
  },
});

describe("hasScreenshotDetail", () => {
  it("is true only for an event that carries a screenshot detail", () => {
    expect(
      hasScreenshotDetail(
        images("screenshotImages", {
          added: [2],
          removed: [2],
          reordered: false,
        }),
      ),
    ).toBe(true);
    expect(
      hasScreenshotDetail({
        ...base,
        field: "screenshots",
        before: "5",
        after: "8",
      }),
    ).toBe(false);
    expect(
      hasScreenshotDetail({ ...base, field: "title", before: "a", after: "b" }),
    ).toBe(false);
  });
});

describe("screenshotChangeSummary", () => {
  it("names the replaced screenshots", () => {
    expect(
      screenshotChangeSummary(
        images("screenshotImages", {
          added: [2],
          removed: [2],
          reordered: false,
        }),
      ),
    ).toBe("Screenshot 2 replaced");
    expect(
      screenshotChangeSummary(
        images("screenshotImages", {
          added: [1, 3],
          removed: [1, 3],
          reordered: false,
        }),
      ),
    ).toBe("Screenshots 1 and 3 replaced");
  });

  it("says a screenshot was added or removed", () => {
    expect(
      screenshotChangeSummary(
        images("screenshots", { added: [4], removed: [], reordered: false }),
      ),
    ).toBe("Screenshot 4 added");
    expect(
      screenshotChangeSummary(
        images("screenshots", { added: [], removed: [2, 3], reordered: false }),
      ),
    ).toBe("Screenshots 2 and 3 removed");
  });

  it("says the order changed, alone or with a replacement", () => {
    expect(
      screenshotChangeSummary(
        images("screenshotImages", { added: [], removed: [], reordered: true }),
      ),
    ).toBe("Screenshots reordered");
    expect(
      screenshotChangeSummary(
        images("screenshotImages", {
          added: [2],
          removed: [2],
          reordered: true,
        }),
      ),
    ).toBe("Screenshot 2 replaced, screenshots reordered");
  });

  it("summarises a caption change by what appeared and disappeared", () => {
    expect(
      screenshotChangeSummary({
        ...base,
        field: "screenshotCaptions",
        before: "Plan your week",
        after: "Plan your day",
        detail: {
          kind: "captions",
          added: ["Plan your day"],
          removed: ["Plan your week"],
        },
      }),
    ).toBe("Caption changed: “Plan your week” to “Plan your day”");
  });
});
