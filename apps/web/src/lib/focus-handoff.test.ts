import { describe, expect, it } from "vitest";
import {
  CLAIM_WINDOW_MS,
  focusCanMoveTo,
  focusIsLost,
  isClaimable,
  survivingNeighbour,
} from "./focus-handoff";

const body = { tag: "body" };

describe("focusIsLost", () => {
  it("is true when nothing or the body has focus", () => {
    expect(focusIsLost({ activeElement: null, body })).toBe(true);
    expect(focusIsLost({ activeElement: body, body })).toBe(true);
  });

  it("is false when a control has focus", () => {
    expect(focusIsLost({ activeElement: { tag: "button" }, body })).toBe(false);
  });
});

describe("focusCanMoveTo", () => {
  const target = { tag: "row" };
  const holding = (...held: unknown[]) => ({
    contains: (node: unknown) => held.includes(node),
  });

  it("is true when focus is lost", () => {
    expect(focusCanMoveTo(target, { activeElement: body, body })).toBe(true);
  });

  it("is true when focus rests on a container of the target", () => {
    expect(
      focusCanMoveTo(target, { activeElement: holding(target), body }),
    ).toBe(true);
  });

  it("is false when a control outside the target has focus", () => {
    expect(focusCanMoveTo(target, { activeElement: holding(), body })).toBe(
      false,
    );
    expect(
      focusCanMoveTo(target, { activeElement: { tag: "button" }, body }),
    ).toBe(false);
  });
});

describe("survivingNeighbour", () => {
  const items = ["a", "b", "c", "d", "e"];
  const without =
    (...gone: string[]) =>
    (item: string) =>
      gone.includes(item);

  it("answers nothing when nothing is removed", () => {
    expect(survivingNeighbour(items, without())).toBeUndefined();
  });

  it("takes the next survivor after one removed item", () => {
    expect(survivingNeighbour(items, without("b"))).toBe("c");
  });

  it("skips removed items that follow", () => {
    expect(survivingNeighbour(items, without("b", "c"))).toBe("d");
  });

  it("takes the next survivor after the first removed item of a scattered set", () => {
    expect(survivingNeighbour(items, without("b", "d"))).toBe("c");
  });

  it("falls back to the item before when the removed ones run to the end", () => {
    expect(survivingNeighbour(items, without("d", "e"))).toBe("c");
  });

  it("falls back to the item before when only the last item is removed", () => {
    expect(survivingNeighbour(items, without("e"))).toBe("d");
  });

  it("answers nothing when every item is removed", () => {
    expect(survivingNeighbour(items, without(...items))).toBeUndefined();
  });

  it("answers nothing when the first item is removed and none survives", () => {
    expect(survivingNeighbour(["a"], without("a"))).toBeUndefined();
  });
});

describe("isClaimable", () => {
  const body = { tag: "body" };
  const follow = { tag: "follow" };
  const search = { tag: "search" };
  const armed = { key: "chart-follow", at: 1_000, from: follow };
  const now = armed.at + 100;

  it("accepts a claimant when focus fell to the body", () => {
    expect(
      isClaimable(armed, "chart-follow", now, { activeElement: body, body }),
    ).toBe(true);
  });

  it("accepts a claimant when nothing has focus", () => {
    expect(
      isClaimable(armed, "chart-follow", now, { activeElement: null, body }),
    ).toBe(true);
  });

  it("accepts a claimant while focus is still on the control that had it", () => {
    expect(
      isClaimable(armed, "chart-follow", now, { activeElement: follow, body }),
    ).toBe(true);
  });

  it("refuses a claimant when focus moved to another control", () => {
    expect(
      isClaimable(armed, "chart-follow", now, { activeElement: search, body }),
    ).toBe(false);
  });

  it("refuses another key", () => {
    expect(
      isClaimable(armed, "competitor:1", now, { activeElement: body, body }),
    ).toBe(false);
  });

  it("refuses when nothing is armed", () => {
    expect(
      isClaimable(null, "chart-follow", now, { activeElement: body, body }),
    ).toBe(false);
  });

  it("accepts at the edge of the window and refuses after it", () => {
    const root = { activeElement: body, body };
    expect(
      isClaimable(armed, "chart-follow", armed.at + CLAIM_WINDOW_MS, root),
    ).toBe(true);
    expect(
      isClaimable(armed, "chart-follow", armed.at + CLAIM_WINDOW_MS + 1, root),
    ).toBe(false);
  });
});
