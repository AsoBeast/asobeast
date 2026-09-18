import { describe, expect, it } from "vitest";
import type { AppAuditResult } from "@asobeast/shared";
import { APP_AUDIT_EXAMPLE } from "./audit-example";
import { auditMarkdown } from "./audit-report";

const APP = { name: "Where Am I? GeoGuess Map Quiz", country: "us" };

const withCheckDetail = (
  audit: AppAuditResult,
  checkId: string,
  detail: string,
): AppAuditResult => ({
  ...audit,
  factors: audit.factors.map((factor) => ({
    ...factor,
    checks: factor.checks.map((check) =>
      check.id === checkId ? { ...check, detail } : check,
    ),
  })),
});

describe("auditMarkdown", () => {
  it("renders the score card, the three horizons, benchmarks and limitations", () => {
    const report = auditMarkdown(APP_AUDIT_EXAMPLE, APP);

    expect(report).toContain("# ASO audit: Where Am I? GeoGuess Map Quiz");
    expect(report).toContain(
      "**72/100 · Grade B, Good · 82% measured · Potential 86**",
    );
    expect(report).toMatch(/^\| Title \| 9\.1\/10 \| Pass \|/m);
    expect(report).toContain("## Quick wins (today)");
    expect(report).toContain("## High impact (this week)");
    expect(report).toContain("## Strategic (this month)");
    expect(report).toContain("## Competitor comparison");
    expect(report).toContain("## What this audit cannot see");
  });

  it("escapes pipes in listing text", () => {
    const report = auditMarkdown(
      withCheckDetail(APP_AUDIT_EXAMPLE, "title-length", "A | B"),
      { name: "X | Y", country: "us" },
    );

    expect(report).toContain("X \\| Y");
    expect(report).toContain("A \\| B");
  });

  it("keeps every table row on one line and escapes backslashes", () => {
    const report = auditMarkdown(
      withCheckDetail(
        APP_AUDIT_EXAMPLE,
        "title-length",
        "Line one\nLine two a \\| b",
      ),
      APP,
    );

    expect(report).toMatch(
      /^\| Title \| .*Line one Line two a \\\\\\\| b \|$/m,
    );
  });

  it("reports group scores on the same scale as the page", () => {
    expect(auditMarkdown(APP_AUDIT_EXAMPLE, APP)).toContain(
      "- Search visibility: 64/100",
    );
  });

  it("leaves out what an older API does not send", () => {
    const report = auditMarkdown(
      { ...APP_AUDIT_EXAMPLE, confidence: undefined, groups: undefined },
      APP,
    );

    expect(report).toContain("**72/100 · Grade B, Good · Potential 86**");
    expect(report).not.toContain("% measured");
  });

  it("says a bucket is empty instead of praising it", () => {
    const report = auditMarkdown(
      {
        ...APP_AUDIT_EXAMPLE,
        recommendations: { quickWins: [], highImpact: [], strategic: [] },
      },
      APP,
    );

    expect(report).toContain("No change is waiting in Quick wins · Today.");
    expect(report).not.toMatch(/great work/i);
  });
});
