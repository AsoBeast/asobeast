import { describe, expect, it } from "vitest";
import { APP_AUDIT_EXAMPLE } from "./audit-example";
import { factorSections } from "./factor-sections";

describe("factorSections", () => {
  it("groups measurable factors by search visibility and conversion", () => {
    const sections = factorSections(APP_AUDIT_EXAMPLE.factors);

    expect(sections.map((section) => section.label)).toEqual([
      "Search visibility",
      "Conversion",
    ]);
    expect(
      sections
        .flatMap((section) => section.factors)
        .some((factor) => factor.availability === "not-measurable"),
    ).toBe(false);
  });

  it("keeps factors an older API sent without a group", () => {
    const factors = APP_AUDIT_EXAMPLE.factors.map((factor) => ({
      ...factor,
      group: undefined,
      availability: undefined,
    }));

    expect(factorSections(factors)).toEqual([
      { id: "factors", label: "Factors", factors },
    ]);
  });
});
