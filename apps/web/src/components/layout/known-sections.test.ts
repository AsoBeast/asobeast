import { describe, expect, it } from "vitest";
import { COMPETITOR_SECTIONS } from "@/components/competitors/competitor-sections";
import { OVERVIEW_SECTIONS } from "@/components/overview/overview-sections";
import {
  COLLAPSED_VALUE_MAX_CHARS,
  serializeCollapsed,
} from "@/lib/collapsed-sections";
import { KNOWN_SECTIONS } from "./known-sections";

describe("KNOWN_SECTIONS", () => {
  it("names every section once", () => {
    expect(new Set(KNOWN_SECTIONS).size).toBe(KNOWN_SECTIONS.length);
  });

  it("scopes every section to its page", () => {
    for (const id of KNOWN_SECTIONS) {
      expect(id).toMatch(/^[a-z]+\.[A-Za-z]+$/);
    }
  });

  it("fits every section in the cookie at once", () => {
    expect(
      serializeCollapsed(new Set(KNOWN_SECTIONS), KNOWN_SECTIONS).length,
    ).toBeLessThanOrEqual(COLLAPSED_VALUE_MAX_CHARS);
  });

  it("knows every competitors section", () => {
    expect(KNOWN_SECTIONS).toEqual(
      expect.arrayContaining([...COMPETITOR_SECTIONS]),
    );
  });

  it("knows every overview section", () => {
    expect(KNOWN_SECTIONS).toEqual(
      expect.arrayContaining([...OVERVIEW_SECTIONS]),
    );
  });
});
