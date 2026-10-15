import { describe, expect, it } from "vitest";
import {
  isPickerStrategy,
  pickerButtonLabel,
  remainingToTarget,
} from "./keyword-picker";

describe("pickerButtonLabel", () => {
  it("names the selection it would track", () => {
    expect(pickerButtonLabel(0)).toBe("Track selected");
    expect(pickerButtonLabel(1)).toBe("Track 1 selected");
    expect(pickerButtonLabel(3)).toBe("Track 3 selected");
  });
});

describe("remainingToTarget", () => {
  it("counts the keywords still missing to reach the target", () => {
    expect(remainingToTarget(4, 10)).toBe(6);
    expect(remainingToTarget(12, 10)).toBe(0);
    expect(remainingToTarget(null, 10)).toBe(10);
  });
});

describe("isPickerStrategy", () => {
  it("accepts only the strategies the picker offers", () => {
    expect(isPickerStrategy("metadata")).toBe(true);
    expect(isPickerStrategy("search")).toBe(true);
    expect(isPickerStrategy("similar")).toBe(false);
  });
});
