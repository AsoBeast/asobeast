import { CHANGE_FIELDS } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { CHANGE_FIELD_LABELS } from "@/lib/change-fields";
import { snapshotChangeCells, snapshotChangeLabel } from "./snapshot-change";

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
    expect(snapshotChangeLabel({ field: "whatsNew" })).toBe("What's New");
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

  it("keeps the recorded screenshot wording", () => {
    expect(
      snapshotChangeCells({
        field: "screenshotImages",
        before: "8 screenshots",
        after: "8 screenshots, reordered",
      }),
    ).toEqual({ before: "8 screenshots", after: "8 screenshots, reordered" });
  });
});
