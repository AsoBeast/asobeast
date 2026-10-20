import { describe, expect, it } from "vitest";
import { isChecked } from "./comparison-checks";

describe("isChecked", () => {
  it("reads a row without the field as checked", () => {
    expect(isChecked({}, "comp-1")).toBe(true);
  });

  it("is false only for an app the row lists", () => {
    const row = { unchecked: ["comp-1"] };
    expect(isChecked(row, "comp-1")).toBe(false);
    expect(isChecked(row, "comp-2")).toBe(true);
    expect(isChecked(row, "app-1")).toBe(true);
  });
});
