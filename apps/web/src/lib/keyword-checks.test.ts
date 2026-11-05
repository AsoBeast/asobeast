import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  FIRST_CHECK_POLL_LIMIT,
  FIRST_CHECK_POLL_MS,
  isChecking,
  keywordsPollInterval,
  lostPosition,
  staleCheckDay,
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

describe("staleCheckDay", () => {
  const today = "2026-10-22";

  it("W-CHK-03 names the day of an active row last checked before yesterday", () => {
    expect(
      staleCheckDay({ active: true, latestCheckedOn: "2026-10-20" }, today),
    ).toBe("2026-10-20");
  });

  it("W-CHK-04 a check from today or yesterday is current", () => {
    expect(
      staleCheckDay({ active: true, latestCheckedOn: "2026-10-22" }, today),
    ).toBeNull();
    expect(
      staleCheckDay({ active: true, latestCheckedOn: "2026-10-21" }, today),
    ).toBeNull();
  });

  it("W-CHK-05 a paused, never checked or undated row is never stale", () => {
    expect(
      staleCheckDay({ active: false, latestCheckedOn: "2026-10-01" }, today),
    ).toBeNull();
    expect(
      staleCheckDay({ active: true, latestCheckedOn: null }, today),
    ).toBeNull();
    expect(staleCheckDay({ active: true }, today)).toBeNull();
  });
});

describe("lostPosition", () => {
  const unranked = {
    latestPosition: null,
    latestDepth: 200,
    previousPosition: null,
  };

  it("W-CHK-06 answers the last ranked position of a keyword lost yesterday", () => {
    expect(
      lostPosition({
        ...unranked,
        previousPosition: 14,
        lastRankedPosition: 14,
        lastRankedOn: "2026-11-02",
      }),
    ).toEqual({ position: 14, on: "2026-11-02" });
  });

  it("W-CHK-07 keeps answering it while the keyword stays lost", () => {
    expect(
      lostPosition({
        ...unranked,
        lastRankedPosition: 9,
        lastRankedOn: "2026-10-22",
      }),
    ).toEqual({ position: 9, on: "2026-10-22" });
  });

  it("W-CHK-08 falls back to the day before on an api without the field", () => {
    expect(lostPosition({ ...unranked, previousPosition: 6 })).toEqual({
      position: 6,
      on: null,
    });
  });

  it("W-CHK-09 trusts the api when it says the keyword never ranked", () => {
    expect(
      lostPosition({
        ...unranked,
        previousPosition: 6,
        lastRankedPosition: null,
        lastRankedOn: null,
      }),
    ).toBeNull();
  });

  it("W-CHK-10 answers nothing for a ranked, never checked or never ranked row", () => {
    expect(
      lostPosition({
        ...unranked,
        latestPosition: 3,
        previousPosition: 4,
        lastRankedPosition: null,
      }),
    ).toBeNull();
    expect(
      lostPosition({
        ...unranked,
        latestDepth: null,
        previousPosition: 4,
      }),
    ).toBeNull();
    expect(
      lostPosition({
        ...unranked,
        lastRankedPosition: null,
        lastRankedOn: null,
      }),
    ).toBeNull();
  });
});
