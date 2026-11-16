import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cardAction,
  CLAIM_WINDOW_MS,
  focusCanMoveTo,
  focusFirstAvailable,
  focusIsLost,
  isClaimable,
  pendingFocusStep,
  recoverFocusIn,
  recoveryCandidates,
  returnFocusTo,
  siblingControl,
  survivingNeighbour,
} from "./focus-handoff";

const body = { tag: "body" };

beforeEach(() => vi.stubGlobal("Node", Object));
afterEach(() => vi.unstubAllGlobals());

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

describe("pendingFocusStep", () => {
  const target = { isConnected: true };
  const stop = { isConnected: true };
  const removed = { isConnected: false };

  it("drops a target that left the page", () => {
    expect(pendingFocusStep(removed, null, { activeElement: body, body })).toBe(
      "drop",
    );
  });

  it("focuses the target once the leaving control is gone and focus is lost", () => {
    expect(
      pendingFocusStep(target, removed, { activeElement: body, body }),
    ).toBe("focus");
  });

  it("waits while focus still rests on the leaving control", () => {
    expect(pendingFocusStep(target, stop, { activeElement: stop, body })).toBe(
      "wait",
    );
  });

  it("drops the target once the user moves focus off a leaving control that stayed", () => {
    expect(
      pendingFocusStep(target, stop, { activeElement: { tag: "other" }, body }),
    ).toBe("drop");
  });

  it("focuses the target when focus is lost while the leaving control stays", () => {
    expect(pendingFocusStep(target, stop, { activeElement: body, body })).toBe(
      "focus",
    );
  });

  it("decides from focus alone when no leaving control is named", () => {
    const container = { contains: (node: unknown) => node === target };
    expect(
      pendingFocusStep(target, null, { activeElement: container, body }),
    ).toBe("focus");
    expect(
      pendingFocusStep(target, null, { activeElement: { tag: "other" }, body }),
    ).toBe("drop");
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

const control = (name: string, hiddenFromUser = false) => ({
  name,
  closest: () => (hiddenFromUser ? { tag: "aria-hidden" } : null),
  matches: () => false,
});
const tabList = (selectedTab: unknown) => ({
  ...control("Range"),
  matches: (selector: string) => selector === '[role="tablist"]',
  querySelector: (selector: string) =>
    selector === '[role="tab"][aria-selected="true"]' ? selectedTab : null,
});

class FakeElement {
  constructor(
    readonly controls: unknown[],
    readonly tabbable = false,
    readonly isConnected = true,
    readonly hiddenFromUser = false,
  ) {}
  closest = () => (this.hiddenFromUser ? { tag: "aria-hidden" } : null);
  querySelectorAll(selector: string) {
    this.selector = selector;
    return this.controls;
  }
  selector = "";
  hasAttribute(name: string) {
    return name === "tabindex" && this.tabbable;
  }
}
const container = (...args: ConstructorParameters<typeof FakeElement>) =>
  new FakeElement(...args);
const asElement = (fake: FakeElement) => fake as unknown as Element;

describe("recoveryCandidates", () => {
  beforeEach(() => vi.stubGlobal("HTMLElement", FakeElement));

  it("lists the controls left in the container in document order", () => {
    const invite = control("Invite member");
    const search = control("Search");
    expect(recoveryCandidates(asElement(container([invite, search])))).toEqual([
      invite,
      search,
    ]);
  });

  it("asks for form controls as well as links and buttons, each in the tab order", () => {
    const fake = container([]);
    recoveryCandidates(asElement(fake));
    for (const kind of [
      'input:not(:disabled):not([type="hidden"])',
      "select:not(:disabled)",
      "textarea:not(:disabled)",
      "a[href]",
      "button:not(:disabled)",
      "[tabindex]",
    ]) {
      expect(fake.selector).toContain(`${kind}:not([tabindex="-1"])`);
    }
  });

  it("offers a tab list's selected tab in its place, so focus lands on the tab itself", () => {
    const selected = control("30d");
    expect(
      recoveryCandidates(asElement(container([tabList(selected)]))),
    ).toEqual([selected]);
  });

  it("skips a tab list whose selected tab is hidden or inert", () => {
    const invite = control("Invite member");
    const tabs = tabList(control("30d", true));
    expect(recoveryCandidates(asElement(container([tabs, invite])))).toEqual([
      invite,
    ]);
  });

  it("keeps a tab list that has no selected tab", () => {
    const tabs = tabList(null);
    expect(recoveryCandidates(asElement(container([tabs])))).toEqual([tabs]);
  });

  it("skips a control hidden from assistive technology or inert", () => {
    const hidden = control("Backdrop close", true);
    const invite = control("Invite member");
    expect(recoveryCandidates(asElement(container([hidden, invite])))).toEqual([
      invite,
    ]);
  });

  it("ends with the container only when it is focusable and within reach", () => {
    const focusable = container([], true);
    expect(recoveryCandidates(asElement(focusable))).toEqual([focusable]);
    expect(recoveryCandidates(asElement(container([])))).toEqual([]);
    const hidden = asElement(container([], true, true, true));
    expect(recoveryCandidates(hidden).length).toBe(0);
  });

  it("lists nothing for a container that left the page or no container", () => {
    expect(
      recoveryCandidates(asElement(container([control("Add")], false, false))),
    ).toEqual([]);
    expect(recoveryCandidates(null)).toEqual([]);
  });
});

describe("focusFirstAvailable", () => {
  const root: { activeElement: unknown; body: unknown } = {
    activeElement: body,
    body,
  };
  const control = (takesFocus: boolean, child?: unknown) => {
    const element = {
      focus: vi.fn(() => {
        if (takesFocus) root.activeElement = child ?? element;
      }),
      contains: (node: unknown) => node === element || node === child,
    };
    return element;
  };
  const asElements = (controls: unknown[]) =>
    controls as unknown as HTMLElement[];

  it("skips a control that cannot take focus, such as a hidden one", () => {
    root.activeElement = body;
    const hidden = control(false);
    const visible = control(true);
    expect(focusFirstAvailable(asElements([hidden, visible]), root)).toBe(
      visible,
    );
    expect(hidden.focus).toHaveBeenCalled();
    expect(root.activeElement).toBe(visible);
  });

  it("accepts a control that hands focus to a child, such as a tab list", () => {
    root.activeElement = body;
    const activeTab = { tag: "tab" };
    const tabList = control(true, activeTab);
    const clear = control(true);
    expect(focusFirstAvailable(asElements([tabList, clear]), root)).toBe(
      tabList,
    );
    expect(clear.focus).not.toHaveBeenCalled();
    expect(root.activeElement).toBe(activeTab);
  });

  it("stops at the first control that takes focus", () => {
    root.activeElement = body;
    const first = control(true);
    const second = control(true);
    focusFirstAvailable(asElements([first, second]), root);
    expect(second.focus).not.toHaveBeenCalled();
  });

  it("focuses without scrolling the page", () => {
    root.activeElement = body;
    const first = control(true);
    focusFirstAvailable(asElements([first]), root);
    expect(first.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("answers nothing when no control takes focus", () => {
    root.activeElement = body;
    expect(focusFirstAvailable(asElements([control(false)]), root)).toBe(
      undefined,
    );
  });
});

describe("recoverFocusIn", () => {
  beforeEach(() => vi.stubGlobal("HTMLElement", FakeElement));

  const focusRoot = (activeElement: unknown) => ({ activeElement, body });
  const focusable = (root: { activeElement: unknown }) => {
    const element = {
      ...control("Invite member"),
      focus: vi.fn(() => {
        root.activeElement = element;
      }),
      contains: (node: unknown) => node === element,
    };
    return element;
  };

  it("focuses the first control left when focus fell to the body", () => {
    const root = focusRoot(body);
    const invite = focusable(root);
    expect(recoverFocusIn(asElement(container([invite])), root)).toBe(invite);
    expect(root.activeElement).toBe(invite);
  });

  it("never moves focus a person already moved elsewhere", () => {
    const search = { tag: "search" };
    const root = focusRoot(search);
    const invite = focusable(root);
    expect(
      recoverFocusIn(asElement(container([invite])), root),
    ).toBeUndefined();
    expect(invite.focus).not.toHaveBeenCalled();
    expect(root.activeElement).toBe(search);
  });
});
