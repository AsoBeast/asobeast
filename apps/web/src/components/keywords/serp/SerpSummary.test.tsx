import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Store } from "@asobeast/shared";
import type { PlacementSummary, PositionSummary } from "./serp-summary";
import { SerpSummary, SerpSummarySkeleton } from "./SerpSummary";

const TEXT_SEPARATOR = "<!-- -->";

const PLACEMENTS: PlacementSummary = {
  inTitle: 3,
  of: 10,
  inSecond: 0,
  secondKnown: 0,
};

const summaryOf = (
  position: PositionSummary,
  placements: PlacementSummary | null = PLACEMENTS,
  store: Store = "APP_STORE",
) =>
  renderToString(
    <SerpSummary
      facts={{ position, placements, ratings: { kind: "none" } }}
      comparedTo="2026-10-30"
      store={store}
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
        inSecond: 2,
        secondKnown: 1,
      },
    );

    expect(html).toContain(">Keyword in<");
    expect(html).toContain(">8 of 10<");
    expect(html).toContain(">in the title<");
    expect(html).not.toContain(">2 of 1 in the subtitle<");
    expect(html).toContain(
      '<span aria-hidden="true" class="invisible basis-full text-caption">',
    );
    expect(html).not.toContain("Titles with it");
  });

  it("adds the subtitle count once two subtitles are known", () => {
    const html = summaryOf(
      { kind: "absent" },
      {
        inTitle: 8,
        of: 10,
        inSecond: 1,
        secondKnown: 2,
      },
    );

    expect(html).toContain(">1 of 2 in the subtitle<");
    expect(html).not.toContain(TEXT_SEPARATOR);
  });

  it("adds the short description count on Google Play once two are known", () => {
    const html = summaryOf(
      { kind: "absent" },
      { inTitle: 8, of: 10, inSecond: 1, secondKnown: 2 },
      "GOOGLE_PLAY",
    );

    expect(html).toContain(">1 of 2 in the short description<");
    expect(html).toContain(">8 of 10<");
    expect(html).not.toContain("Google Play has no subtitle");
    expect(html).not.toContain(TEXT_SEPARATOR);
  });

  it("keeps the line space on Google Play until two short descriptions are known", () => {
    const html = summaryOf(
      { kind: "absent" },
      { inTitle: 8, of: 10, inSecond: 1, secondKnown: 1 },
      "GOOGLE_PLAY",
    );

    expect(html).toContain(
      'class="invisible basis-full text-caption">0 of 0 in the short description<',
    );
    expect(html).not.toContain(">1 of 1 in the short description<");
  });

  it("reserves the second line in the loading state of each store", () => {
    expect(
      renderToString(<SerpSummarySkeleton store="GOOGLE_PLAY" />),
    ).toContain("0 of 0 in the short description");
    expect(renderToString(<SerpSummarySkeleton store="APP_STORE" />)).toContain(
      "0 of 0 in the subtitle",
    );
  });
});
