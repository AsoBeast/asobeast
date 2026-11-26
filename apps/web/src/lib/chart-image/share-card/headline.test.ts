import { describe, expect, it } from "vitest";
import type {
  RankingPoint,
  RankingSeriesItem,
  VisibilityPoint,
} from "@asobeast/shared";
import { dayBefore } from "@/lib/utc-day";
import {
  keywordHeadline,
  rankingsHeadline,
  visibilityHeadline,
  type ShareHeadline,
} from "./headline";

const END = "2026-10-30";

type PointRow = [
  daysAgo: number,
  position: number | null,
  depth?: number,
  resultCount?: number,
];

function points(rows: readonly PointRow[]): RankingPoint[] {
  return rows.map(([daysAgo, position, depth = 200, resultCount]) => ({
    date: dayBefore(END, daysAgo),
    position,
    depth,
    ...(resultCount === undefined ? {} : { resultCount }),
  }));
}

function steady(first: number, last: number, days = 30): PointRow[] {
  return Array.from({ length: days }, (_, index): PointRow => [
    days - 1 - index,
    index === days - 1 ? last : first,
  ]);
}

function keyword(
  keywordId: string,
  rows: readonly PointRow[],
  text = "geography quiz",
): RankingSeriesItem {
  return {
    keywordId,
    text,
    store: "APP_STORE",
    country: "us",
    points: points(rows),
  };
}

function visibility(values: readonly number[]): VisibilityPoint[] {
  return values.map((value, index) => ({
    date: dayBefore(END, values.length - 1 - index),
    visibility: value,
  }));
}

describe("rankingsHeadline", () => {
  const trio = [
    keyword("kw-1", steady(20, 12)),
    keyword("kw-2", steady(14, 8)),
    keyword("kw-3", steady(10, 6)),
  ];

  it("averages the keywords ranked on every checked day", () => {
    const headline = rankingsHeadline(trio);

    expect(headline).toMatchObject({
      lead: "Average rank across 3 keywords",
      figure: "#8.7",
      trail: null,
      change: "up 6.0 places in 29 days",
      from: dayBefore(END, 29),
      to: END,
      span: 29,
    });
    expect(headline?.line).toHaveLength(30);
    expect(headline?.line[0]?.value).toBeCloseTo(14.667, 2);
    expect(headline?.line.at(-1)?.value).toBeCloseTo(8.667, 2);
  });

  it("leaves out a keyword not ranked on every checked day", () => {
    const missed = steady(5, 4).map((row, index): PointRow =>
      index === 11 ? [row[0], null] : row,
    );

    expect(rankingsHeadline([...trio, keyword("kw-4", missed)])?.lead).toBe(
      "Average rank across 3 keywords",
    );
  });

  it("leaves out a keyword missing a check", () => {
    const gap = steady(5, 4).filter((_, index) => index !== 19);

    expect(rankingsHeadline([...trio, keyword("kw-4", gap)])?.lead).toBe(
      "Average rank across 3 keywords",
    );
  });

  it("reads a fall as down", () => {
    expect(rankingsHeadline([keyword("kw-1", steady(4, 10))])?.change).toBe(
      "down 6.0 places in 29 days",
    );
  });

  it("reads a change under a twentieth as no change", () => {
    const headline = rankingsHeadline([
      keyword("kw-1", steady(10, 10)),
      keyword("kw-2", steady(10, 10)),
      keyword("kw-3", steady(10, 10)),
      ...Array.from({ length: 22 }, (_, index) =>
        keyword(`kw-${index + 4}`, steady(10, index === 0 ? 11 : 10)),
      ),
    ]);

    expect(headline?.figure).toBe("#10.0");
    expect(headline?.change).toBe("no change in 29 days");
  });

  it("counts the span between the first and last checked day", () => {
    const early = steady(9, 7, 27).map(([daysAgo, position]): PointRow => [
      daysAgo + 3,
      position,
    ]);

    const headline = rankingsHeadline([keyword("kw-1", early)]);

    expect(headline?.span).toBe(26);
    expect(headline?.change).toBe("up 2.0 places in 26 days");
    expect(headline?.to).toBe(dayBefore(END, 3));
  });

  it("answers nothing below four checked days", () => {
    expect(rankingsHeadline([keyword("kw-1", steady(9, 7, 3))])).toBeNull();
  });

  it("answers nothing when no keyword is ranked every day", () => {
    const lost = steady(9, 7).map((row, index): PointRow =>
      index === 0 ? [row[0], null] : row,
    );

    expect(rankingsHeadline([keyword("kw-1", lost)])).toBeNull();
  });

  it("names one keyword in the singular", () => {
    expect(rankingsHeadline([keyword("kw-1", steady(9, 7))])?.lead).toBe(
      "Average rank across 1 keyword",
    );
  });
});

describe("keywordHeadline", () => {
  const series = (rows: readonly PointRow[]) => keyword("kw-1", rows);

  it("reads a climb", () => {
    expect(keywordHeadline(series(steady(18, 3)))).toMatchObject({
      lead: "",
      figure: "#3",
      trail: "for “geography quiz”",
      change: "up from #18",
      span: 29,
    });
  });

  it("reads a fall", () => {
    expect(keywordHeadline(series(steady(2, 7)))?.change).toBe("down from #2");
  });

  it("reads an entry from beyond the depth", () => {
    const headline = keywordHeadline(
      series([
        [3, null],
        [2, null],
        [1, 40],
        [0, 9],
      ]),
    );

    expect(headline?.figure).toBe("#9");
    expect(headline?.change).toBe("up from >200");
    expect(headline?.line.map((point) => point.value)).toEqual([
      null,
      null,
      40,
      9,
    ]);
  });

  it("reads a lost rank", () => {
    const headline = keywordHeadline(
      series([
        [3, 14],
        [2, 16],
        [1, 30],
        [0, null],
      ]),
    );

    expect(headline?.figure).toBe(">200");
    expect(headline?.change).toBe("down from #14");
  });

  it("reads no apps", () => {
    expect(
      keywordHeadline(
        series([
          [3, 14],
          [2, 16],
          [1, 30],
          [0, null, 200, 0],
        ]),
      )?.figure,
    ).toBe("No apps");
  });

  it("reads no change", () => {
    expect(keywordHeadline(series(steady(5, 5, 21)))?.change).toBe(
      "no change in 20 days",
    );
  });

  it("answers nothing below four checked days", () => {
    expect(keywordHeadline(series(steady(5, 3, 3)))).toBeNull();
  });
});

describe("visibilityHeadline", () => {
  const rise = Array.from({ length: 30 }, (_, index) =>
    index === 29 ? 64 : 48,
  );

  it("reads a rise as a percentage", () => {
    expect(visibilityHeadline(visibility(rise))).toMatchObject({
      lead: "Visibility",
      figure: "64",
      trail: null,
      change: "up 33% in 29 days",
      span: 29,
    });
  });

  it("reads a fall", () => {
    expect(visibilityHeadline(visibility([80, 70, 65, 60]))?.change).toBe(
      "down 25% in 3 days",
    );
  });

  it("leaves the change out from zero", () => {
    const headline = visibilityHeadline(visibility([0, 4, 9, 12]));

    expect(headline?.figure).toBe("12");
    expect(headline?.change).toBeNull();
  });

  it("answers nothing below four points", () => {
    expect(visibilityHeadline(visibility([10, 20, 30]))).toBeNull();
  });
});

describe("no store text", () => {
  it("never puts a hash before a bound", () => {
    const headlines: (ShareHeadline | null)[] = [
      keywordHeadline(
        keyword("kw-1", [
          [3, null],
          [2, null],
          [1, null],
          [0, null],
        ]),
      ),
      keywordHeadline(
        keyword("kw-1", [
          [3, 5],
          [2, 6],
          [1, 7],
          [0, null, 200, 0],
        ]),
      ),
      keywordHeadline(
        keyword("kw-1", [
          [3, null, 200, 0],
          [2, 6],
          [1, 7],
          [0, 4],
        ]),
      ),
      keywordHeadline(
        keyword("kw-1", [
          [3, null],
          [2, 6],
          [1, 7],
          [0, 4],
        ]),
      ),
    ];
    const texts = headlines.flatMap((headline) => [
      headline?.figure ?? "",
      headline?.change ?? "",
    ]);

    expect(texts.filter((text) => /#[^\d]/.test(text))).toEqual([]);
  });
});
