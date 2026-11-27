import {
  CHANGE_FIELD_LABELS,
  CHANGE_FIELDS,
  type SnapshotChange,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { translationContext } from "@/test/translation-context";
import {
  snapshotChangeCells as cellsInLocale,
  snapshotChangeLabel as labelInLocale,
} from "./snapshot-change";

const en = translationContext("en", "appDetail");
const zh = translationContext("zh-CN", "appDetail");

const snapshotChangeLabel = (
  change: Pick<SnapshotChange, "field" | "localization">,
) => labelInLocale(change, en);
const snapshotChangeCells = (
  change: SnapshotChange,
  currency?: string | null,
) => cellsInLocale(change, currency, en);

describe("snapshotChangeLabel", () => {
  it("names every recorded change field like the changes timeline", () => {
    for (const field of CHANGE_FIELDS) {
      expect(snapshotChangeLabel({ field: field })).toBe(
        CHANGE_FIELD_LABELS[field],
      );
    }
  });

  it("prints the labels the changes timeline prints", () => {
    expect(snapshotChangeLabel({ field: "screenshotImages" })).toBe(
      "Screenshot images",
    );
    expect(snapshotChangeLabel({ field: "whatsNew" })).toBe("What's new");
  });

  it("names the fields only a snapshot diff reports", () => {
    expect(snapshotChangeLabel({ field: "ratingAvg" })).toBe("Rating");
    expect(snapshotChangeLabel({ field: "ratingCount" })).toBe("Ratings");
    expect(snapshotChangeLabel({ field: "installs" })).toBe("Installs");
  });

  it("names the language of a localized change", () => {
    expect(snapshotChangeLabel({ field: "title", localization: "pl" })).toBe(
      "Title · Polish",
    );
  });

  it("passes a field it does not know through", () => {
    expect(snapshotChangeLabel({ field: "somethingNew" })).toBe("somethingNew");
    expect(snapshotChangeLabel({ field: "toString" })).toBe("toString");
  });
});

describe("snapshotChangeCells", () => {
  it("never prints icon urls", () => {
    expect(
      snapshotChangeCells({
        field: "icon",
        before: "https://example.com/a.png",
        after: "https://example.com/b.png",
      }),
    ).toEqual({ before: "—", after: "Icon updated" });
  });

  it("flattens whats new onto one line", () => {
    expect(
      snapshotChangeCells({
        field: "whatsNew",
        before: null,
        after: "• Faster maps\n• New badges",
      }),
    ).toEqual({ before: "—", after: "Faster maps · New badges" });
  });

  it("renders empty values as a dash and numbers as text", () => {
    expect(
      snapshotChangeCells({ field: "ratingCount", before: null, after: 7 }),
    ).toEqual({ before: "—", after: "7" });
    expect(
      snapshotChangeCells({ field: "version", before: "", after: "1.1.0" }),
    ).toEqual({ before: "—", after: "1.1.0" });
  });

  it("shows a rating with one decimal like the overview", () => {
    expect(
      snapshotChangeCells({ field: "ratingAvg", before: 3.1, after: 4.31881 }),
    ).toEqual({ before: "3.1", after: "4.3" });
    expect(
      snapshotChangeCells({ field: "ratingAvg", before: null, after: 5 }),
    ).toEqual({ before: "—", after: "5.0" });
  });

  it("separates the thousands of the rating count and the installs", () => {
    expect(
      snapshotChangeCells({ field: "ratingCount", before: 100, after: 66487 }),
    ).toEqual({ before: "100", after: "66,487" });
    expect(
      snapshotChangeCells({
        field: "installs",
        before: 1000,
        after: 1200000,
      }),
    ).toEqual({ before: "1,000", after: "1,200,000" });
    expect(
      snapshotChangeCells({ field: "ratingCount", before: 0, after: 1000 }),
    ).toEqual({ before: "0", after: "1,000" });
  });

  it("words a recorded price as free or an amount in the storefront currency", () => {
    expect(
      snapshotChangeCells(
        { field: "price", before: "1.99", after: "0" },
        "EUR",
      ),
    ).toEqual({ before: "€1.99", after: "Free" });
    expect(
      snapshotChangeCells({ field: "price", before: "0", after: "500" }, "JPY"),
    ).toEqual({ before: "Free", after: "¥500" });
    expect(
      snapshotChangeCells({ field: "price", before: null, after: 2 }, "USD"),
    ).toEqual({ before: "—", after: "$2.00" });
  });

  it("writes a price whose currency is unknown as a bare number", () => {
    expect(
      snapshotChangeCells({ field: "price", before: "1.99", after: "0" }),
    ).toEqual({ before: "1.99", after: "Free" });
    expect(
      snapshotChangeCells({ field: "price", before: "1.99", after: "0" }, null),
    ).toEqual({ before: "1.99", after: "Free" });
  });

  it("does not give the currency to a field that is not a price", () => {
    expect(
      snapshotChangeCells(
        { field: "installs", before: 1000, after: 1200000 },
        "EUR",
      ),
    ).toEqual({ before: "1,000", after: "1,200,000" });
  });

  it("counts recorded screenshots the way the changes timeline does", () => {
    expect(
      snapshotChangeCells({ field: "screenshots", before: "8", after: "1200" }),
    ).toEqual({ before: "8", after: "1,200" });
  });

  it("keeps a value that is not a number as the store sent it", () => {
    expect(
      snapshotChangeCells({ field: "price", before: "free", after: "1,99" }),
    ).toEqual({ before: "free", after: "1,99" });
    expect(
      snapshotChangeCells({ field: "ratingAvg", before: "n/a", after: 4 }),
    ).toEqual({ before: "n/a", after: "4.0" });
  });

  it("leaves the version as written", () => {
    expect(
      snapshotChangeCells({
        field: "version",
        before: "1.0.0",
        after: "9.1.0",
      }),
    ).toEqual({ before: "1.0.0", after: "9.1.0" });
  });

  it("reports the length of a text field in characters", () => {
    expect(
      snapshotChangeCells({ field: "title", before: 3, after: 1200 }),
    ).toEqual({ before: "3 chars", after: "1,200 chars" });
    expect(
      snapshotChangeCells({ field: "subtitle", before: null, after: 7 }),
    ).toEqual({ before: "—", after: "7 chars" });
  });
});

describe("snapshotChangeCells store summaries", () => {
  it("keeps the recorded screenshot wording", () => {
    expect(
      snapshotChangeCells({
        field: "screenshotImages",
        before: "8 screenshots",
        after: "8 screenshots, reordered",
      }),
    ).toEqual({ before: "8 screenshots", after: "8 screenshots, reordered" });
  });

  it("summarizes a store decided change from its detail", () => {
    expect(
      snapshotChangeCells({
        field: "inAppEvents",
        before: null,
        after: null,
        detail: {
          kind: "events",
          added: [
            {
              appEventId: "e1",
              title: "Double XP weekend",
              kind: null,
              badge: null,
              startsAt: null,
              endsAt: null,
            },
          ],
          removed: [],
        },
      }),
    ).toEqual({ before: "—", after: "Event added: Double XP weekend" });
    expect(
      snapshotChangeCells({
        field: "editorsChoice",
        before: null,
        after: null,
        detail: { kind: "editorsChoice", showsBadge: true, notes: null },
      }),
    ).toEqual({ before: "—", after: "Editors' Choice badge added" });
    expect(
      snapshotChangeCells({
        field: "featuring",
        before: null,
        after: null,
        detail: {
          kind: "featuring",
          added: [],
          removed: [{ storyId: "s1", heading: "Today", title: null }],
        },
      }),
    ).toEqual({ before: "—", after: "Featured story removed: Today" });
  });

  it("leaves a store decided change without a detail as a dash", () => {
    expect(
      snapshotChangeCells({ field: "inAppEvents", before: null, after: null }),
    ).toEqual({ before: "—", after: "—" });
  });

  it("localizes field labels, character counts and free prices in Chinese", () => {
    expect(labelInLocale({ field: "title", localization: "pl" }, zh)).toBe(
      "标题 · 波兰语",
    );
    expect(
      cellsInLocale({ field: "title", before: 3, after: 1200 }, null, zh),
    ).toEqual({ before: "3 个字符", after: "1,200 个字符" });
    expect(
      cellsInLocale({ field: "price", before: "1.99", after: "0" }, "EUR", zh),
    ).toEqual({ before: "€1.99", after: "免费" });
    expect(
      cellsInLocale(
        {
          field: "icon",
          before: "https://example.com/a.png",
          after: "https://example.com/b.png",
        },
        null,
        zh,
      ),
    ).toEqual({ before: "—", after: "图标已更新" });
  });

  it("localizes store-decided snapshot summaries without translating their names", () => {
    expect(
      cellsInLocale(
        {
          field: "inAppEvents",
          before: null,
          after: null,
          detail: {
            kind: "events",
            added: [
              {
                appEventId: "e1",
                title: "Double XP weekend",
                kind: null,
                badge: null,
                startsAt: null,
                endsAt: null,
              },
            ],
            removed: [],
          },
        },
        null,
        zh,
      ),
    ).toEqual({ before: "—", after: "已添加应用内活动：Double XP weekend" });
    expect(
      cellsInLocale(
        {
          field: "editorsChoice",
          before: null,
          after: null,
          detail: { kind: "editorsChoice", showsBadge: true, notes: null },
        },
        null,
        zh,
      ),
    ).toEqual({ before: "—", after: "已添加编辑精选徽章" });
  });
});
