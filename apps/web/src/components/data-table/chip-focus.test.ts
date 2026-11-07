import { describe, expect, it } from "vitest";
import { lastControlBefore } from "./chip-focus";

const listOf = (members: readonly string[]) => ({
  contains: (node: string) => members.includes(node),
});

const shown = () => true;

describe("lastControlBefore", () => {
  it("answers the nearest control above the chips", () => {
    expect(
      lastControlBefore(
        ["search", "facet", "export", "remove-a", "clear"],
        listOf(["remove-a", "clear"]),
        shown,
      ),
    ).toBe("export");
  });

  it("skips a control that is not shown", () => {
    expect(
      lastControlBefore(
        ["search", "sheet", "remove-a"],
        listOf(["remove-a"]),
        (control) => control !== "sheet",
      ),
    ).toBe("search");
  });

  it("answers nothing when no control comes before the chips", () => {
    expect(
      lastControlBefore(["remove-a"], listOf(["remove-a"]), shown),
    ).toBeNull();
  });

  it("reads every control when the chips hold none of them", () => {
    expect(lastControlBefore(["search", "export"], listOf([]), shown)).toBe(
      "export",
    );
  });
});
