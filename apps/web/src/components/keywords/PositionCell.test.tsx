import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";
import { PositionCell } from "./keyword-cells";

const TODAY = "2026-10-22";

const keyword = (over: Partial<TrackedKeywordItem>): TrackedKeywordItem => ({
  keywordId: "kw-1",
  text: "focus timer",
  tags: [],
  note: null,
  country: "us",
  serpVolatility7d: null,
  source: "TITLE",
  active: true,
  latestPosition: 7,
  latestDepth: 200,
  latestCheckedOn: TODAY,
  previousPosition: 5,
  positionDelta1d: 2,
  positionDelta7d: null,
  traffic: 55,
  difficulty: 4,
  volume: 5000,
  relevance: 90,
  opportunity: 82,
  bucket: "primary",
  scoredAt: "2026-10-22",
  scoreProvenance: null,
  ...over,
});

const HISTORY = {
  appId: "app-1",
  store: "APP_STORE",
  homeCountry: "us",
  multiMarket: false,
} as const;

const render = (row: TrackedKeywordItem, multiMarket = false) =>
  renderToStaticMarkup(
    <TooltipProvider>
      <PositionCell
        keyword={row}
        today={TODAY}
        history={{ ...HISTORY, multiMarket }}
      />
    </TooltipProvider>,
  );

const CLOCK = "lucide-history";

const CHART = "lucide-chart-line";

describe("PositionCell", () => {
  it("W-POS-01 marks a stale check with a clock that names its day", () => {
    const markup = render(keyword({ latestCheckedOn: "2026-10-19" }));

    expect(markup).toContain(
      'aria-label="Position history: focus timer, last checked Oct 19"',
    );
    expect(markup).toContain(CLOCK);
    expect(markup).not.toContain(CHART);
    expect(markup).not.toContain("Last checked");
    expect(markup).not.toContain("since yesterday");
  });

  it("W-POS-02 a fresh check keeps a history button and leaves the change to its column", () => {
    const markup = render(keyword({ latestCheckedOn: "2026-10-21" }));

    expect(markup).not.toContain("since yesterday");
    expect(markup).toContain('aria-label="Position history: focus timer"');
    expect(markup).toContain(CHART);
    expect(markup).not.toContain(CLOCK);
  });

  it("W-POS-03 a paused row shows no clock", () => {
    expect(
      render(keyword({ active: false, latestCheckedOn: "2026-10-01" })),
    ).not.toContain(CLOCK);
  });

  it("W-POS-04 a row without the field shows no clock", () => {
    const { latestCheckedOn, ...undated } = keyword({});
    const markup = render(undated);

    expect(latestCheckedOn).toBe(TODAY);
    expect(markup).not.toContain(CLOCK);
  });

  it("W-POS-05 a stale check that did not find the app keeps its bound", () => {
    const markup = render(
      keyword({ latestPosition: null, latestCheckedOn: "2026-10-19" }),
    );

    expect(markup).toContain("&gt;200");
    expect(markup).toContain(CLOCK);
  });

  it("W-POS-06 a keyword awaiting its first check still reads checking", () => {
    const markup = render(
      keyword({
        latestPosition: null,
        latestDepth: null,
        latestCheckedOn: null,
      }),
    );

    expect(markup).toContain("Checking…");
    expect(markup).not.toContain(CLOCK);
    expect(markup).not.toContain("Position history");
  });

  it("W-POS-07 a fresh row with hold facts shows the chart icon", () => {
    const markup = render(
      keyword({ bestPosition: 5, positionDeltaFromBest: 2 }),
    );

    expect(markup).toContain('aria-label="Position history: focus timer"');
    expect(markup).toContain(CHART);
    expect(markup).not.toContain("lucide-info");
    expect(markup).not.toContain(CLOCK);
  });

  it("W-POS-08 names the market when the app tracks several", () => {
    expect(render(keyword({}), true)).toContain(
      'aria-label="Position history: focus timer (US)"',
    );
  });

  it("W-POS-09 a keyword never checked has no history button", () => {
    expect(
      render(
        keyword({
          active: false,
          latestPosition: null,
          latestDepth: null,
          latestCheckedOn: null,
        }),
      ),
    ).not.toContain("Position history");
  });

  it("W-POS-10 a keyword not found keeps its history button", () => {
    const markup = render(keyword({ latestPosition: null }));

    expect(markup).toContain("&gt;200");
    expect(markup).toContain('aria-label="Position history: focus timer"');
  });

  it("W-POS-11 a keyword that lost its rank says where it was under the bound", () => {
    const markup = render(
      keyword({
        latestPosition: null,
        previousPosition: null,
        positionDelta1d: null,
        lastRankedPosition: 14,
        lastRankedOn: "2026-10-21",
      }),
    );

    expect(markup).toContain("<span>&gt;200</span>");
    expect(markup).toContain(">was #14<");
    expect(markup).toContain(
      `title="Last ranked #14 on ${formatDate("2026-10-21")}"`,
    );
    expect(markup).not.toContain("since yesterday");
  });

  it("W-POS-12 an older api shows the position of the day before", () => {
    const markup = render(
      keyword({
        latestPosition: null,
        previousPosition: 6,
        positionDelta1d: null,
      }),
    );

    expect(markup).toContain(">was #6<");
    expect(markup).not.toContain("Last ranked");
  });

  it("W-POS-13 a ranked keyword carries no hint and keeps its chip", () => {
    const markup = render(
      keyword({ lastRankedPosition: null, lastRankedOn: null }),
    );

    expect(markup).not.toContain(">was #");
    expect(markup).toMatch(/title="Position \d+[^"]*"[^>]*min-w-9/);
  });

  it("W-POS-14 a stale lost keyword keeps the hint and the clock", () => {
    const markup = render(
      keyword({
        latestPosition: null,
        latestCheckedOn: "2026-10-19",
        lastRankedPosition: 14,
        lastRankedOn: "2026-10-12",
      }),
    );

    expect(markup).toContain(">was #14<");
    expect(markup).toContain(CLOCK);
  });

  it("W-POS-15 a keyword never checked or never ranked carries no hint", () => {
    const checking = render(
      keyword({
        latestPosition: null,
        latestDepth: null,
        latestCheckedOn: null,
        lastRankedPosition: null,
        lastRankedOn: null,
      }),
    );
    const neverRanked = render(
      keyword({
        latestPosition: null,
        previousPosition: null,
        lastRankedPosition: null,
        lastRankedOn: null,
      }),
    );

    expect(checking).toContain("Checking…");
    expect(checking).not.toContain("(was");
    expect(neverRanked).toContain(">&gt;200<");
    expect(neverRanked).not.toContain("(was");
  });
});
