import { describe, expect, it, vi } from "vitest";
import {
  cardAction,
  CLAIM_WINDOW_MS,
  focusCanMoveTo,
  focusIsLost,
  isClaimable,
  returnFocusTo,
  siblingControl,
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

describe("siblingControl", () => {
  const control = (name: string) => ({ name });
  const rowOf = (
    name: string,
    held: { name: string } | null = control(name),
  ) => ({
    name,
    parentElement: null as unknown,
    querySelector: () => held,
  });
  const listOf = (...rows: ReturnType<typeof rowOf>[]) => {
    const parent = { children: rows };
    for (const row of rows) row.parentElement = parent;
    return rows;
  };
  const siblingOf = (row: unknown) =>
    siblingControl(row as Element, "button") as unknown as {
      name: string;
    } | null;

  it("takes the control of the next row", () => {
    const [, middle] = listOf(rowOf("a"), rowOf("b"), rowOf("c"));
    expect(siblingOf(middle)).toEqual(control("c"));
  });

  it("takes the control of the previous row when the last one leaves", () => {
    const [, last] = listOf(rowOf("a"), rowOf("b"));
    expect(siblingOf(last)).toEqual(control("a"));
  });

  it("answers nothing for an only row", () => {
    const [only] = listOf(rowOf("a"));
    expect(siblingOf(only)).toBeNull();
  });

  it("answers nothing without a row", () => {
    expect(siblingControl(null, "button")).toBeNull();
  });

  it("answers nothing when the neighbour holds no such control", () => {
    const [first] = listOf(rowOf("a"), rowOf("b", null));
    expect(siblingOf(first)).toBeNull();
  });
});

describe("returnFocusTo", () => {
  const closing = () => ({ preventDefault: vi.fn() });
  const target = (isConnected: boolean) => ({ isConnected, focus: vi.fn() });
  const handlerFor = (element: ReturnType<typeof target> | null) =>
    returnFocusTo({ current: element as unknown as HTMLElement });

  it("focuses a connected target instead of the default", () => {
    const element = target(true);
    const event = closing();

    handlerFor(element)(event as unknown as Event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(element.focus).toHaveBeenCalled();
  });

  it("leaves the default to run for a target that left the document", () => {
    const element = target(false);
    const event = closing();

    handlerFor(element)(event as unknown as Event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(element.focus).not.toHaveBeenCalled();
  });

  it("leaves the default to run without a target", () => {
    const event = closing();

    returnFocusTo(undefined)(event as unknown as Event);
    handlerFor(null)(event as unknown as Event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe("cardAction", () => {
  const action = { name: "Add" };
  const elementIn = (card: unknown) =>
    ({ closest: () => card }) as unknown as Element;

  it("takes the header button of the card holding the element", () => {
    const card = { querySelector: () => action };
    expect(cardAction(elementIn(card))).toBe(action);
  });

  it("answers nothing outside a card or without a header button", () => {
    expect(cardAction(elementIn(null))).toBeNull();
    expect(cardAction(elementIn({ querySelector: () => null }))).toBeNull();
    expect(cardAction(null)).toBeNull();
  });
});
