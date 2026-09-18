import { describe, expect, it } from "vitest";
import type {
  AuditRecommendation,
  AuditRecommendations,
} from "@asobeast/shared";
import { topFixes } from "./top-fixes";

const fix = (checkId: string, lift: number): AuditRecommendation => ({
  factorId: "title",
  checkId,
  label: `Fix ${checkId}`,
  detail: "Evidence.",
  lift,
});

const buckets = (
  quickWins: AuditRecommendation[],
  highImpact: AuditRecommendation[] = [],
  strategic: AuditRecommendation[] = [],
): AuditRecommendations => ({ quickWins, highImpact, strategic });

describe("topFixes", () => {
  it("takes the three largest lifts across every bucket", () => {
    const result = topFixes(
      buckets(
        [fix("a", 1), fix("b", 4.2)],
        [fix("c", 2.1)],
        [fix("d", 6), fix("e", 0.2)],
      ),
    );

    expect(result.map((item) => item.checkId)).toEqual(["d", "b", "c"]);
  });

  it("breaks a tie by bucket order, then by check id", () => {
    const result = topFixes(
      buckets([fix("z", 3)], [fix("a", 3)], [fix("b", 3), fix("a2", 3)]),
      4,
    );

    expect(result.map((item) => item.checkId)).toEqual(["z", "a", "a2", "b"]);
  });

  it("returns fewer than three when there are fewer", () => {
    expect(topFixes(buckets([fix("a", 1)]))).toHaveLength(1);
  });
});
