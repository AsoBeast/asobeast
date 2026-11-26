import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlacementSummary, PositionSummary } from "./serp-summary";
import { SerpSummary } from "./SerpSummary";

const TEXT_SEPARATOR = "<!-- -->";

const PLACEMENTS: PlacementSummary = {
  inTitle: 3,
  of: 10,
  inSubtitle: null,
  subtitlesKnown: null,
};

const summaryOf = (
  position: PositionSummary,
  placements: PlacementSummary | null = PLACEMENTS,
) =>
  renderToString(
    <SerpSummary
      facts={{ position, placements, ratings: { kind: "none" } }}
      comparedTo="2026-10-30"
    />,
  );

describe("SerpSummary", () => {
  it("writes each value as one text node, so a new day rewrites it whole", () => {
    const deeper = summaryOf({ kind: "deeper", position: 34, listed: 10 });
    const notFound = summaryOf({ kind: "notFound", depth: 200 });
    const noApps = summaryOf({ kind: "noApps" });

    expect(deeper).toContain(">#34<");
    expect(deeper).toContain(">below the top 10<");
    expect(deeper).toContain(">3 of 10<");
    expect(notFound).toContain(">Not in the top 200<");
    expect(noApps).toContain(">The store lists no apps for this search<");
    expect(deeper).not.toContain(TEXT_SEPARATOR);
    expect(notFound).not.toContain(TEXT_SEPARATOR);
    expect(noApps).not.toContain(TEXT_SEPARATOR);
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

  it("names the tile Keyword in and reads the title count", () => {
    const html = summaryOf(
      { kind: "absent" },
      {
        inTitle: 8,
        of: 10,
        inSubtitle: 2,
        subtitlesKnown: 1,
      },
    );

    expect(html).toContain(">Keyword in<");
    expect(html).toContain(">8 of 10<");
    expect(html).toContain(">in the title<");
    expect(html).not.toContain("in the subtitle");
    expect(html).not.toContain("Titles with it");
  });

  it("adds the subtitle count once two subtitles are known", () => {
    const html = summaryOf(
      { kind: "absent" },
      {
        inTitle: 8,
        of: 10,
        inSubtitle: 2,
        subtitlesKnown: 3,
      },
    );

    expect(html).toContain(">2 of 3 in the subtitle<");
    expect(html).not.toContain(TEXT_SEPARATOR);
  });

  it("says Google Play has no subtitle", () => {
    const html = summaryOf({ kind: "absent" });

    expect(html).toContain(">Google Play has no subtitle<");
  });
});
