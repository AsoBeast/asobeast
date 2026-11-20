import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AppAuditResult } from "@asobeast/shared";
import { AuditReadiness } from "./AuditReadiness";

const audit = (stories: number): AppAuditResult => ({
  appId: "app-1",
  store: "APP_STORE",
  overall: 74,
  coveredWeight: 95,
  totalWeight: 110,
  factors: [],
  recommendations: { quickWins: [], highImpact: [], strategic: [] },
  ai: { configured: false, model: null, generatedAt: null },
  generatedAt: "2026-11-17T00:00:00.000Z",
  readiness: {
    items: [],
    editorial: { stories, editorsChoiceBadge: false },
    extractAsOf: "2026-11-14",
  },
});

const text = (stories: number) =>
  renderToStaticMarkup(<AuditReadiness audit={audit(stories)} />);

describe("AuditReadiness", () => {
  it("pluralizes the featured stories of the editorial line", () => {
    const markup = text(2);

    expect(markup).toContain("In 2 featured stories");
    expect(markup).not.toContain("storys");
  });

  it("names a single featured story", () => {
    expect(text(1)).toContain("In 1 featured story");
  });

  it("adds the row label to the name of a scoring link", () => {
    const markup = renderToStaticMarkup(
      <AuditReadiness
        audit={{
          ...audit(1),
          readiness: {
            items: [
              {
                id: "rating",
                label: "Average rating",
                status: "pass",
                detail: null,
                link: {
                  href: "#factors-conversion",
                  label: "Where the audit scores it",
                },
              },
            ],
            editorial: { stories: 1, editorsChoiceBadge: false },
            extractAsOf: "2026-11-14",
          },
        }}
      />,
    );

    expect(markup).toContain("Where the audit scores it");
    expect(markup).toContain("Average rating");
  });
});
