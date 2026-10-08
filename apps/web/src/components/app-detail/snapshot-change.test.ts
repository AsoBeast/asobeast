import { CHANGE_FIELDS } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { CHANGE_FIELD_LABELS } from "@/lib/change-fields";
import { snapshotChangeCells, snapshotChangeLabel } from "./snapshot-change";

describe("snapshotChangeLabel", () => {
  it("names every recorded change field like the changes timeline", () => {
    for (const field of CHANGE_FIELDS) {
      expect(snapshotChangeLabel(field)).toBe(CHANGE_FIELD_LABELS[field]);
    }
  });

  it("prints the labels the changes timeline prints", () => {
    expect(snapshotChangeLabel("screenshotImages")).toBe("Screenshot images");
    expect(snapshotChangeLabel("whatsNew")).toBe("What's New");
  });

  it("names the fields only a snapshot diff reports", () => {
    expect(snapshotChangeLabel("ratingAvg")).toBe("Rating");
    expect(snapshotChangeLabel("ratingCount")).toBe("Ratings");
    expect(snapshotChangeLabel("installs")).toBe("Installs");
  });

  it("passes a field it does not know through", () => {
    expect(snapshotChangeLabel("somethingNew")).toBe("somethingNew");
    expect(snapshotChangeLabel("toString")).toBe("toString");
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
