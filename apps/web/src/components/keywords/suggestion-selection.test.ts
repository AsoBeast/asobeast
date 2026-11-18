import { describe, expect, it } from "vitest";
import {
  trackingSelectedMessage,
  trackSelectedLabel,
  withTick,
} from "./suggestion-selection";

describe("trackSelectedLabel", () => {
  it("names the selection it would track", () => {
    expect(trackSelectedLabel(0)).toBe("Track selected");
    expect(trackSelectedLabel(1)).toBe("Track 1 selected");
    expect(trackSelectedLabel(3)).toBe("Track 3 selected");
  });
});

describe("trackingSelectedMessage", () => {
  it("counts the keywords and promises positions", () => {
    expect(trackingSelectedMessage(1)).toBe(
      "Tracking 1 keyword. Positions arrive within minutes.",
    );
    expect(trackingSelectedMessage(3)).toBe(
      "Tracking 3 keywords. Positions arrive within minutes.",
    );
  });
});

describe("withTick", () => {
  it("adds and removes a text without touching the set it was given", () => {
    const start = new Set(["focus"]);
    expect([...withTick(start, "timer", true)]).toEqual(["focus", "timer"]);
    expect([...withTick(start, "focus", false)]).toEqual([]);
    expect([...start]).toEqual(["focus"]);
  });
});
