import { describe, expect, it } from "vitest";
import type { KeywordImportCost, StoreDailyBudget } from "@asobeast/shared";
import { importBudgetNotice } from "./import-budget";

const cost = (
  dailyRequests: number,
  keywordMarkets = dailyRequests,
): KeywordImportCost => ({
  store: "APP_STORE",
  keywordMarkets,
  dailyRequests,
});

const store = (total: number, capacityPerDay = 21_600): StoreDailyBudget => ({
  store: "APP_STORE",
  apps: 1,
  keywords: total,
  categories: 0,
  reviews: 0,
  total,
  capacityPerDay,
  utilization: total / capacityPerDay,
});

describe("importBudgetNotice", () => {
  it("U-BUD-01 says nothing when the import opens no keyword market", () => {
    expect(importBudgetNotice(cost(0, 0), store(100), true)).toBeNull();
  });

  it("U-BUD-02 tells anyone how many store requests a day it adds", () => {
    expect(importBudgetNotice(cost(1_200, 150), null, false)).toEqual({
      tone: "info",
      text: "Adds about 1,200 store requests a day. Each new keyword is also scored once, which takes more requests over the next hours.",
    });
  });

  it("says one store request in the singular", () => {
    expect(importBudgetNotice(cost(1), null, false)?.text).toMatch(
      /^Adds about 1 store request a day\. /,
    );
  });

  it("U-BUD-03 tells the operator the share of daily capacity after the import", () => {
    expect(importBudgetNotice(cost(1_200), store(10_000), true)).toEqual({
      tone: "info",
      text: "Adds about 1,200 store requests a day, taking App Store to 52% of its daily capacity. Each new keyword is also scored once, which takes more requests over the next hours.",
    });
  });

  it("U-BUD-04 warns from 85 percent and says the run will not finish above 100", () => {
    expect(importBudgetNotice(cost(1_000), store(18_000), true)?.tone).toBe(
      "warning",
    );
    const over = importBudgetNotice(cost(1_000), store(21_000), true);

    expect(over?.tone).toBe("critical");
    expect(over?.text).toContain("102%");
    expect(over?.text).toContain("will not finish within a day");
  });

  it("U-BUD-05 keeps the store request wording of Google Play", () => {
    expect(
      importBudgetNotice(
        { store: "GOOGLE_PLAY", keywordMarkets: 100, dailyRequests: 800 },
        { ...store(0, 14_400), store: "GOOGLE_PLAY" },
        true,
      )?.text,
    ).toContain("taking Google Play to 6% of its daily capacity");
  });
});
