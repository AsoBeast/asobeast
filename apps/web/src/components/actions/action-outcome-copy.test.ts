import { ACTION_OUTCOME_VERDICTS, type ActionOutcome } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { OUTCOME_VERDICT_LABEL, outcomeSentence } from "./action-outcome-copy";

const outcome = (overrides: Partial<ActionOutcome> = {}): ActionOutcome => ({
  metric: "position",
  direction: "lower_is_better",
  before: 16,
  beforeDate: "2026-07-20",
  after: 7,
  afterDate: "2026-07-30",
  change: -9,
  verdict: "improved",
  ...overrides,
});

describe("outcomeSentence", () => {
  it("writes a position change with both dates", () => {
    expect(outcomeSentence(outcome(), 200)).toBe(
      "Position #16 → #7 between Jul 20, 2026 and Jul 30, 2026.",
    );
  });

  it("writes an unranked position in words", () => {
    expect(outcomeSentence(outcome({ before: null }), 200)).toBe(
      "Position not in the top 200 → #7 between Jul 20, 2026 and Jul 30, 2026.",
    );
  });

  it("writes a score change as numbers", () => {
    expect(
      outcomeSentence(
        outcome({
          metric: "audit",
          direction: "higher_is_better",
          before: 58,
          after: 61.5,
        }),
        null,
      ),
    ).toBe("Audit score 58 → 61.5 between Jul 20, 2026 and Jul 30, 2026.");
  });

  it("explains what a pending outcome waits for", () => {
    expect(
      outcomeSentence(
        outcome({ verdict: "pending", beforeDate: "2026-07-29" }),
        200,
      ),
    ).toBe(
      "Measured from Jul 29, 2026. asobeast needs three days of data after you marked it done.",
    );
  });

  it("labels every verdict", () => {
    for (const verdict of ACTION_OUTCOME_VERDICTS) {
      expect(OUTCOME_VERDICT_LABEL[verdict].length).toBeGreaterThan(0);
    }
  });
});
