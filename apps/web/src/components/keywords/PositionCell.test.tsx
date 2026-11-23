import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TrackedKeywordItem } from "@asobeast/shared";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/format";
import type { TrendSeries, TrendState, TrendWindow } from "@/lib/trend-window";
import { PositionCell, TrendCell, TrendHeading } from "./keyword-cells";

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

const render = (row: TrackedKeywordItem) =>
  renderToStaticMarkup(
    <TooltipProvider>
      <PositionCell keyword={row} today={TODAY} />
    </TooltipProvider>,
  );

const renderTrend = (
  row: TrackedKeywordItem,
  multiMarket = false,
  trendWindow: TrendWindow = "7d",
  series?: TrendSeries,
  state?: TrendState,
) =>
  renderToStaticMarkup(
    <TrendCell
      keyword={row}
      today={TODAY}
      history={{ ...HISTORY, multiMarket }}
      trendWindow={trendWindow}
      series={series}
      state={state}
    />,
  );

const CLOCK = "lucide-history";

describe("PositionCell", () => {
  it("W-POS-01 marks a stale check with a clock that names its day", () => {
    const stale = keyword({ latestCheckedOn: "2026-10-19" });
    const markup = render(stale);

    expect(markup).toContain(CLOCK);
    expect(markup).toContain(">last checked Oct 19<");
    expect(markup).toContain(
      `title="Last checked ${formatDate("2026-10-19")};`,
    );
    expect(markup).not.toContain("since yesterday");
    expect(renderTrend(stale)).toContain(
      'aria-label="Position history: focus timer, last checked Oct 19"',
    );
  });

  it("W-POS-02 a fresh check shows no clock and its trend opens the history", () => {
    const fresh = keyword({ latestCheckedOn: "2026-10-21" });
    const markup = render(fresh);

    expect(markup).not.toContain("since yesterday");
    expect(markup).not.toContain(CLOCK);
    expect(markup).not.toContain("Position history");
    expect(renderTrend(fresh)).toContain(
      'aria-label="Position history: focus timer"',
    );
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
    const checking = keyword({
      latestPosition: null,
      latestDepth: null,
      latestCheckedOn: null,
    });
    const markup = render(checking);

    expect(markup).toContain("Checking…");
    expect(markup).not.toContain(CLOCK);
    expect(renderTrend(checking)).not.toContain("Position history");
  });

  it("W-POS-07 the trend button is described by its line and its change", () => {
    const markup = renderTrend(
      keyword({
        positionDelta7d: -3,
        recentPositions: [
          { date: "2026-10-20", position: 10 },
          { date: "2026-10-21", position: 8 },
          { date: "2026-10-22", position: 7 },
        ],
      }),
    );
    const described = /aria-describedby="([^"]+)"/.exec(markup)?.[1];

    expect(described).toBeDefined();
    expect(markup).toMatch(
      new RegExp(
        `id="${described}"[^>]*>.*Position over the last 7 days, from 10 to 7.*up 3 over 7 days`,
      ),
    );
  });

  it("W-POS-30 draws the 30 day window and names its delta", () => {
    const series: TrendSeries = new Map([
      [
        "kw-1",
        [
          { date: "2026-09-23", position: 30, depth: 200 },
          { date: "2026-10-01", position: 20, depth: 200 },
          { date: "2026-10-21", position: 12, depth: 200 },
          { date: "2026-10-22", position: 10, depth: 200 },
        ],
      ],
    ]);

    const markup = renderTrend(
      keyword({ positionDelta7d: -1 }),
      false,
      "30d",
      series,
    );

    expect(markup).toContain("Position over the last 30 days, from 30 to 10");
    expect(markup).toContain('aria-label="up 20 over 30 days"');
  });

  it("W-POS-31 says so when the window has too few ranked checks", () => {
    const series: TrendSeries = new Map([
      ["kw-1", [{ date: "2026-10-22", position: 10, depth: 200 }]],
    ]);

    const markup = renderTrend(keyword({}), false, "30d", series);

    expect(markup).toContain("Not enough checks");
    expect(markup).not.toContain('data-slot="position-trend"');
  });

  it("W-POS-32 says Loading, not no change, while the 30 day series is pending", () => {
    const markup = renderTrend(
      keyword({ positionDelta7d: 0 }),
      false,
      "30d",
      undefined,
      "pending",
    );

    expect(markup).toContain("Loading");
    expect(markup).not.toContain("Not enough checks");
    expect(markup).not.toContain('data-slot="position-trend"');
    expect(markup).not.toContain("—");
  });

  it("W-POS-33 says Not loaded when the 30 day series failed", () => {
    const markup = renderTrend(keyword({}), false, "30d", undefined, "failed");

    expect(markup).toContain("Not loaded");
    expect(markup).not.toContain("Not enough checks");
  });

  it("W-POS-34 draws a paused row's 30 day line from its series", () => {
    const series: TrendSeries = new Map([
      [
        "kw-1",
        [
          { date: "2026-10-18", position: 20, depth: 200 },
          { date: "2026-10-19", position: 18, depth: 200 },
          { date: "2026-10-20", position: 15, depth: 200 },
        ],
      ],
    ]);
    const markup = renderTrend(
      keyword({ active: false, keywordId: "kw-1" }),
      false,
      "30d",
      series,
    );

    expect(markup).toContain('data-slot="position-trend"');
    expect(markup).toContain("text-muted-foreground");
  });

  it("W-POS-35 ends a paused row's 30 day line on its last check, not on today", () => {
    const series: TrendSeries = new Map([
      [
        "kw-1",
        [
          { date: "2026-10-01", position: 20, depth: 200 },
          { date: "2026-10-02", position: 15, depth: 200 },
        ],
      ],
    ]);

    const markup = renderTrend(
      keyword({ active: false, positionDelta7d: null }),
      false,
      "30d",
      series,
    );

    expect(markup).toContain('cx="23.5"');
    expect(markup).toContain('aria-label="up 5 over 30 days"');
  });

  it("W-POS-36 says Not enough checks for a checked row with no check in the 30 days", () => {
    const series: TrendSeries = new Map([["kw-1", []]]);

    const markup = renderTrend(
      keyword({ active: false }),
      false,
      "30d",
      series,
    );

    expect(markup).toContain("Not enough checks");
    expect(markup).not.toContain('data-slot="position-trend"');
  });

  it("W-POS-37 leaves a never checked row empty in the 30 day window", () => {
    const series: TrendSeries = new Map([["kw-1", []]]);

    const markup = renderTrend(
      keyword({
        latestPosition: null,
        latestDepth: null,
        latestCheckedOn: null,
        recentPositions: [],
      }),
      false,
      "30d",
      series,
    );

    expect(markup).not.toContain("Not enough checks");
  });

  it("W-POS-38 keeps the pending text to its own width so narrow tables do not grow", () => {
    const markup = renderTrend(keyword({}), false, "30d", undefined, "pending");

    expect(markup).toContain("Loading");
    expect(markup).not.toContain("width:72px");
  });

  it("W-POS-39 drops Last from the 30 day heading only on a narrow table", () => {
    const thirty = renderToStaticMarkup(<TrendHeading trendWindow="30d" />);
    const seven = renderToStaticMarkup(<TrendHeading trendWindow="7d" />);

    expect(thirty).toBe(
      '<span><span class="keywords-tight:hidden">Last </span><span>30 days</span></span>',
    );
    expect(seven).toBe("<span><span>Last </span><span>7 days</span></span>");
  });

  it("W-POS-08 names the market when the app tracks several", () => {
    expect(renderTrend(keyword({}), true)).toContain(
      'aria-label="Position history: focus timer (US)"',
    );
  });

  it("W-POS-09 a keyword never checked has no history button", () => {
    expect(
      renderTrend(
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
    const lost = keyword({ latestPosition: null });

    expect(render(lost)).toContain("&gt;200");
    expect(renderTrend(lost)).toContain(
      'aria-label="Position history: focus timer"',
    );
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

  it("W-POS-40 a search that lists no apps reads No apps with the sentence", () => {
    const markup = render(
      keyword({
        latestPosition: null,
        latestResultCount: 0,
        lastRankedPosition: 14,
        lastRankedOn: "2026-10-21",
      }),
    );

    expect(markup).toContain(">No apps</span>");
    expect(markup).toContain(">was #14<");
    expect(markup).toContain(
      'aria-label="No apps: The store lists no apps for this search"',
    );
    expect(markup).toContain(
      `title="The store lists no apps for this search. Last ranked #14 on ${formatDate("2026-10-21")}"`,
    );
  });

  it("W-POS-41 a no-apps row without a last rank keeps only the sentence", () => {
    const markup = render(
      keyword({
        latestPosition: null,
        previousPosition: null,
        positionDelta1d: null,
        lastRankedPosition: null,
        lastRankedOn: null,
        latestResultCount: 0,
      }),
    );

    expect(markup).toContain(">No apps</span>");
    expect(markup).not.toContain("was #");
    expect(markup).toContain('title="The store lists no apps for this search"');
  });

  it("W-POS-42 a bound without a count keeps its text and no sentence", () => {
    const markup = render(keyword({ latestPosition: null }));

    expect(markup).toContain("&gt;200");
    expect(markup).not.toContain("No apps");
    expect(markup).not.toContain("The store lists no apps");
  });
});
