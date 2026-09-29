import { describe, expect, it } from "vitest";
import { commandFor, isTypingTarget, nextFocus } from "./queue-keys";

const key = (value: string, modifiers: Partial<KeyboardEvent> = {}) => ({
  key: value,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...modifiers,
});

describe("commandFor", () => {
  it("maps every key in the shortcut table", () => {
    expect(commandFor(key("j"))).toEqual({ kind: "move", delta: 1 });
    expect(commandFor(key("ArrowDown"))).toEqual({ kind: "move", delta: 1 });
    expect(commandFor(key("k"))).toEqual({ kind: "move", delta: -1 });
    expect(commandFor(key("ArrowUp"))).toEqual({ kind: "move", delta: -1 });
    expect(commandFor(key("Enter"))).toEqual({ kind: "open" });
    expect(commandFor(key("o"))).toEqual({ kind: "open" });
    expect(commandFor(key("s"))).toEqual({ kind: "snooze" });
    expect(commandFor(key("x"))).toEqual({ kind: "select" });
    expect(commandFor(key("/"))).toEqual({ kind: "search" });
    expect(commandFor(key("?", { shiftKey: true }))).toEqual({ kind: "help" });
    expect(commandFor(key("Escape"))).toEqual({ kind: "clear" });
  });

  it("tells done from dismiss by the shift key", () => {
    expect(commandFor(key("d"))).toEqual({ kind: "done" });
    expect(commandFor(key("D", { shiftKey: true }))).toEqual({
      kind: "dismiss",
    });
  });

  it("ignores any chord with a modifier", () => {
    expect(commandFor(key("j", { metaKey: true }))).toBeNull();
    expect(commandFor(key("d", { ctrlKey: true }))).toBeNull();
    expect(commandFor(key("k", { altKey: true }))).toBeNull();
    expect(commandFor(key("z"))).toBeNull();
  });
});

describe("isTypingTarget", () => {
  const element = (matches: string[], isContentEditable = false) =>
    ({
      isContentEditable,
      closest: (selector: string) =>
        matches.some((tag) => selector.includes(tag)) ? {} : null,
    }) as unknown as EventTarget;

  it("treats text fields and editable content as typing targets", () => {
    for (const tag of ["input", "textarea", "select", "contenteditable"]) {
      expect(isTypingTarget(element([tag]))).toBe(true);
    }
    expect(isTypingTarget(element([], true))).toBe(true);
  });

  it("leaves rows, buttons and the page alone", () => {
    expect(isTypingTarget(element([]))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("nextFocus", () => {
  const ids = ["a", "b", "c"];

  it("starts at the first row", () => {
    expect(nextFocus(ids, null, 1)).toBe("a");
    expect(nextFocus(ids, "gone", -1)).toBe("a");
    expect(nextFocus([], null, 1)).toBeNull();
  });

  it("moves one row and stops at both ends", () => {
    expect(nextFocus(ids, "a", 1)).toBe("b");
    expect(nextFocus(ids, "c", 1)).toBe("c");
    expect(nextFocus(ids, "a", -1)).toBe("a");
  });
});
