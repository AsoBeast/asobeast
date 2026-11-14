import { describe, expect, it } from "vitest";
import { APP_AUDIT_EXAMPLE } from "./audit-example";
import { checkSummary } from "./check-counts";

describe("checkSummary", () => {
  it("counts every check of the measurable factors by status", () => {
    const summary = checkSummary(APP_AUDIT_EXAMPLE.factors);

    expect(summary.total).toBe(
      APP_AUDIT_EXAMPLE.factors.reduce(
        (sum, factor) => sum + factor.checks.length,
        0,
      ),
    );
    expect(summary.factors).toBe(APP_AUDIT_EXAMPLE.factors.length);
    expect(
      summary.counts.pass +
        summary.counts.warn +
        summary.counts.fail +
        summary.counts.unanswered,
    ).toBe(summary.total);
    expect(summary.counts.unanswered).toBe(1);
  });

  it("leaves out a factor the store cannot measure", () => {
    const [first, ...rest] = APP_AUDIT_EXAMPLE.factors;
    const summary = checkSummary([
      { ...first, availability: "not-measurable" },
      ...rest,
    ]);

    expect(summary.factors).toBe(rest.length);
    expect(summary.total).toBe(
      rest.reduce((sum, factor) => sum + factor.checks.length, 0),
    );
  });

  it("is empty without factors", () => {
    expect(checkSummary([])).toEqual({
      counts: { pass: 0, warn: 0, fail: 0, unanswered: 0 },
      total: 0,
      factors: 0,
    });
  });
});
