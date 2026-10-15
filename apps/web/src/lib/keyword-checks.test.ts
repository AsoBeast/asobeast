import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  FIRST_CHECK_POLL_LIMIT,
  FIRST_CHECK_POLL_MS,
  isChecking,
  keywordsPollInterval,
} from "./keyword-checks";

const row = (active: boolean, latestDepth: number | null): TrackedKeywordItem =>
  ({ active, latestDepth }) as unknown as TrackedKeywordItem;

describe("isChecking", () => {
  it("W-CHK-01 a row is checking while active and never checked", () => {
    expect(isChecking({ active: true, latestDepth: null })).toBe(true);
    expect(isChecking({ active: true, latestDepth: 200 })).toBe(false);
    expect(isChecking({ active: false, latestDepth: null })).toBe(false);
  });
});

describe("keywordsPollInterval", () => {
  it("W-CHK-02 the list polls while a row is checking and stops after the budget", () => {
    const rows = [row(true, 200), row(true, null)];

    expect(keywordsPollInterval(rows, 0)).toBe(FIRST_CHECK_POLL_MS);
    expect(keywordsPollInterval(rows, FIRST_CHECK_POLL_LIMIT - 1)).toBe(
      FIRST_CHECK_POLL_MS,
    );
    expect(keywordsPollInterval(rows, FIRST_CHECK_POLL_LIMIT)).toBe(false);
    expect(keywordsPollInterval([row(true, 200), row(false, null)], 0)).toBe(
      false,
    );
    expect(keywordsPollInterval(undefined, 0)).toBe(false);
  });
});
