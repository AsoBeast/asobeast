import { describe, expect, it } from "vitest";
import { movementText } from "./movement-text";

describe("movementText", () => {
  it("says how a row moved", () => {
    expect(movementText({ movement: "up", delta: -12, previous: 30 })).toBe(
      "Up 12 from #30",
    );
    expect(movementText({ movement: "down", delta: 3, previous: 4 })).toBe(
      "Down 3 from #4",
    );
    expect(movementText({ movement: "same", delta: 0, previous: 5 })).toBe(
      "No change",
    );
    expect(movementText({ movement: "new", delta: null, previous: null })).toBe(
      "New entry",
    );
    expect(
      movementText({ movement: "none", delta: null, previous: null }),
    ).toBe("No earlier capture");
  });

  it("says what the caller names a row without an earlier position", () => {
    expect(
      movementText(
        { movement: "none", delta: null, previous: null },
        "No earlier position",
      ),
    ).toBe("No earlier position");
  });
});
