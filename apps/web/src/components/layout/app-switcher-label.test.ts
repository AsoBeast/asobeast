import { describe, expect, it } from "vitest";
import type { AppListItem } from "@asobeast/shared";
import { switcherSubtitle } from "./app-switcher-label";

const APPS = [{ id: "app-1" }, { id: "app-2" }] as AppListItem[];

describe("switcherSubtitle", () => {
  it("counts a list that was read", () => {
    expect(switcherSubtitle(APPS, false)).toBe("2 tracked");
  });

  it("counts a list that was read and is empty as zero", () => {
    expect(switcherSubtitle([], false)).toBe("0 tracked");
  });

  it("keeps the count of a list whose later refresh failed", () => {
    expect(switcherSubtitle(APPS, true)).toBe("2 tracked");
  });

  it("says the list could not be loaded when no list was read and the read failed", () => {
    expect(switcherSubtitle(undefined, true)).toBe("Could not load apps");
  });

  it("says the list is loading while no list was read and nothing failed", () => {
    expect(switcherSubtitle(undefined, false)).toBe("Loading apps…");
  });
});
