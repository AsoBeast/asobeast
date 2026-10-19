import { describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "@asobeast/shared";
import {
  COLLAPSED_COOKIE_MAX_AGE,
  COLLAPSED_COOKIE_NAME,
  COLLAPSED_VALUE_MAX_CHARS,
  collapsedCookie,
  parseCollapsed,
  readCollapsedCookie,
  serializeCollapsed,
  withSection,
} from "./collapsed-sections";
import { SIDEBAR_COOKIE_NAME } from "./sidebar-cookie";

const MATRIX = "competitors.matrix";
const DISCOVERY = "competitors.discovery";
const TRACKED = "competitors.tracked";
const KNOWN = [TRACKED, DISCOVERY, MATRIX];

describe("parseCollapsed", () => {
  it.each([undefined, "", "   "])(
    "answers an empty set for an absent, empty or blank value (%j)",
    (value) => {
      expect(parseCollapsed(value, KNOWN).size).toBe(0);
    },
  );

  it("reads comma separated ids", () => {
    expect([...parseCollapsed(`${MATRIX},${DISCOVERY}`, KNOWN)]).toEqual([
      MATRIX,
      DISCOVERY,
    ]);
  });

  it("trims the space around an id", () => {
    expect([...parseCollapsed(` ${MATRIX} , ${DISCOVERY} `, KNOWN)]).toEqual([
      MATRIX,
      DISCOVERY,
    ]);
  });

  it("drops an id the page does not know", () => {
    expect([...parseCollapsed(`competitors.bogus,${MATRIX}`, KNOWN)]).toEqual([
      MATRIX,
    ]);
  });

  it("drops duplicates", () => {
    expect(parseCollapsed(`${MATRIX},${MATRIX}`, KNOWN).size).toBe(1);
  });

  it("drops empty segments", () => {
    expect([...parseCollapsed(`,,${MATRIX},`, KNOWN)]).toEqual([MATRIX]);
  });

  it("is case sensitive", () => {
    expect(parseCollapsed("Competitors.Matrix", KNOWN).size).toBe(0);
  });

  it("never matches a name inherited from Object", () => {
    expect(parseCollapsed("__proto__,constructor,toString", KNOWN).size).toBe(
      0,
    );
  });

  it("answers an empty set for a value over the limit even when it starts with a known id", () => {
    expect(parseCollapsed(`${MATRIX},${"x".repeat(1100)}`, KNOWN).size).toBe(0);
    const atLimit = MATRIX.padEnd(COLLAPSED_VALUE_MAX_CHARS, ",");
    expect([...parseCollapsed(atLimit, KNOWN)]).toEqual([MATRIX]);
    expect(parseCollapsed(`${atLimit},`, KNOWN).size).toBe(0);
  });

  it.each(["{}", "null", ";;;", `${MATRIX};drop`])(
    "answers an empty set for garbage (%j)",
    (value) => {
      expect(parseCollapsed(value, KNOWN).size).toBe(0);
    },
  );
});

describe("serializeCollapsed", () => {
  it("writes ids in the order the page knows them, whatever the order of the set", () => {
    expect(serializeCollapsed(new Set([MATRIX, TRACKED]), KNOWN)).toBe(
      `${TRACKED},${MATRIX}`,
    );
  });

  it("leaves out an id the page does not know", () => {
    expect(
      serializeCollapsed(new Set(["competitors.bogus", MATRIX]), KNOWN),
    ).toBe(MATRIX);
  });

  it("answers an empty string for an empty set", () => {
    expect(serializeCollapsed(new Set(), KNOWN)).toBe("");
  });

  it("round trips with parseCollapsed", () => {
    const subsets = KNOWN.reduce<string[][]>(
      (all, id) => [...all, ...all.map((subset) => [...subset, id])],
      [[]],
    );
    for (const subset of subsets) {
      const set = new Set(subset);
      expect(parseCollapsed(serializeCollapsed(set, KNOWN), KNOWN)).toEqual(
        set,
      );
    }
  });
});

describe("withSection", () => {
  it("adds a section when it closes", () => {
    expect(withSection(new Set(), "a.b", false).has("a.b")).toBe(true);
  });

  it("removes a section when it opens", () => {
    expect(withSection(new Set(["a.b"]), "a.b", true).size).toBe(0);
  });

  it("never mutates the set it was given", () => {
    const empty = new Set<string>();
    const closed = new Set(["a.b"]);
    withSection(empty, "a.b", false);
    withSection(closed, "a.b", true);
    expect(empty.size).toBe(0);
    expect([...closed]).toEqual(["a.b"]);
  });
});

describe("collapsedCookie", () => {
  it("writes the assignment for the document", () => {
    expect(collapsedCookie(`${DISCOVERY},${MATRIX}`)).toBe(
      "asobeast_collapsed=competitors.discovery%2Ccompetitors.matrix; path=/; max-age=31536000; samesite=lax",
    );
  });

  it("deletes the cookie when nothing is collapsed", () => {
    expect(collapsedCookie("")).toBe(
      "asobeast_collapsed=; path=/; max-age=0; samesite=lax",
    );
  });

  it("lives for a year", () => {
    expect(COLLAPSED_COOKIE_MAX_AGE).toBe(31536000);
  });

  it("does not collide with the session or sidebar cookie", () => {
    expect(COLLAPSED_COOKIE_NAME).not.toBe(SESSION_COOKIE);
    expect(COLLAPSED_COOKIE_NAME).not.toBe(SIDEBAR_COOKIE_NAME);
  });
});

describe("readCollapsedCookie", () => {
  it("finds its own pair among others", () => {
    expect(
      readCollapsedCookie(
        "sidebar_state=true; asobeast_collapsed=competitors.matrix%2Ccompetitors.discovery; theme=dark",
      ),
    ).toBe(`${MATRIX},${DISCOVERY}`);
  });

  it.each(["sidebar_state=true", ""])(
    "answers undefined when the cookie is absent (%j)",
    (value) => {
      expect(readCollapsedCookie(value)).toBeUndefined();
    },
  );

  it("does not match a cookie whose name only ends with its own", () => {
    expect(
      readCollapsedCookie("x_asobeast_collapsed=competitors.matrix"),
    ).toBeUndefined();
  });

  it("answers undefined for a malformed escape", () => {
    expect(
      readCollapsedCookie("asobeast_collapsed=competitors.matrix%E0%A4%A"),
    ).toBeUndefined();
  });
});
