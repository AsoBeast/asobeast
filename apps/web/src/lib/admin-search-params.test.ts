import { describe, expect, it } from "vitest";
import {
  adminConversionWindowParser,
  adminFlagParser,
  adminStageParser,
  loadAdminOverviewSearch,
} from "./search-params";

describe("admin search params", () => {
  it("reads the funnel window as 30 or 90 days, 30 by default", () => {
    expect(loadAdminOverviewSearch({ days: "90" }).days).toBe(90);
    expect(loadAdminOverviewSearch({}).days).toBe(30);
    for (const days of ["7", "abc", "", "90.0"]) {
      expect(loadAdminOverviewSearch({ days }).days).toBe(30);
    }
    expect(adminConversionWindowParser.serialize(90)).toBe("90");
  });

  it("keeps only known stages and flags, once each", () => {
    expect(adminStageParser.parse("paying,trialing,paying,gone")).toEqual([
      "paying",
      "trialing",
    ]);
    expect(adminFlagParser.parse("deleting,canceling,nope")).toEqual([
      "deleting",
      "canceling",
    ]);
  });
});
