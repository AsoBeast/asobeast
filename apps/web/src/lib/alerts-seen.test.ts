import { describe, expect, it } from "vitest";
import {
  hasUnread,
  isNewSince,
  laterOf,
  parseSeen,
  readSeenCookie,
  seenCookie,
} from "./alerts-seen";

const T10 = "2026-11-03T10:00:00.000Z";
const T11 = "2026-11-03T11:00:00.000Z";

describe("parseSeen", () => {
  it("accepts an instant that round trips", () => {
    expect(parseSeen(T10)).toBe(T10);
  });

  it.each([
    undefined,
    "",
    "yesterday",
    "2026-11-03",
    "2026-11-03T10:00:00Z",
    `${T10}${"0".repeat(20)}`,
  ])("refuses %j", (value) => {
    expect(parseSeen(value)).toBeNull();
  });
});

describe("the seen cookie", () => {
  it("writes the instant for a year on every path", () => {
    expect(seenCookie("2026-11-03T04:12:00.000Z")).toBe(
      "asobeast_alerts_seen=2026-11-03T04%3A12%3A00.000Z; path=/; max-age=31536000; samesite=lax",
    );
  });

  it("reads it back out of a cookie string holding others", () => {
    const value = seenCookie(T10).split(";")[0];

    expect(
      readSeenCookie(`asobeast_collapsed=a; ${value}; sidebar_state=true`),
    ).toBe(T10);
    expect(readSeenCookie("asobeast_collapsed=a")).toBeUndefined();
  });

  it("answers nothing for a malformed escape", () => {
    expect(readSeenCookie("asobeast_alerts_seen=%E0%A4%A")).toBeUndefined();
  });
});

describe("hasUnread", () => {
  it("is false without a newest event", () => {
    expect(hasUnread(undefined, null)).toBe(false);
    expect(hasUnread(null, T10)).toBe(false);
  });

  it("is true for a newest event never seen", () => {
    expect(hasUnread(T10, null)).toBe(true);
  });

  it("compares the newest event with the last visit", () => {
    expect(hasUnread(T11, T10)).toBe(true);
    expect(hasUnread(T10, T10)).toBe(false);
    expect(hasUnread(T10, T11)).toBe(false);
  });
});

describe("isNewSince", () => {
  it("marks nothing for a browser that never visited", () => {
    expect(isNewSince(T11, null)).toBe(false);
  });

  it("marks only an event strictly after the visit", () => {
    expect(isNewSince(T11, T10)).toBe(true);
    expect(isNewSince(T10, T10)).toBe(false);
    expect(isNewSince(T10, T11)).toBe(false);
  });
});

describe("laterOf", () => {
  it("keeps the later instant", () => {
    expect(laterOf(T10, T11)).toBe(T11);
    expect(laterOf(T11, T10)).toBe(T11);
    expect(laterOf(T10, T10)).toBe(T10);
    expect(laterOf(null, T10)).toBe(T10);
  });
});
