import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PositionSummary } from "./serp-summary";
import { SerpSummary } from "./SerpSummary";

const TEXT_SEPARATOR = "<!-- -->";

const summaryOf = (position: PositionSummary) =>
  renderToString(
    <SerpSummary
      facts={{
        position,
        titles: { withKeyword: 3, of: 10 },
        ratings: { kind: "none" },
      }}
      comparedTo="2026-10-30"
    />,
  );

describe("SerpSummary", () => {
  it("writes each value as one text node, so a new day rewrites it whole", () => {
    const deeper = summaryOf({ kind: "deeper", position: 34, listed: 10 });
    const notFound = summaryOf({ kind: "notFound", depth: 200 });

    expect(deeper).toContain(">#34<");
    expect(deeper).toContain(">below the top 10<");
    expect(deeper).toContain(">3 of 10<");
    expect(notFound).toContain(">Not in the top 200<");
    expect(deeper).not.toContain(TEXT_SEPARATOR);
    expect(notFound).not.toContain(TEXT_SEPARATOR);
  });

  it("keeps the movement of a listed position in one text node", () => {
    const listed = summaryOf({
      kind: "listed",
      position: 4,
      moved: { movement: "up", delta: -2, previous: 6 },
    });

    expect(listed).toContain("<span>2</span>");
    expect(listed).not.toContain(TEXT_SEPARATOR);
  });
});
