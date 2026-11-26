import { describe, expect, it } from "vitest";
import {
  departuresTitle as localizedDeparturesTitle,
  formatShare,
  funnelRows as localizedFunnelRows,
  medianLine as localizedMedianLine,
  rateChange,
  trialRate,
  unrecordedNote as localizedUnrecordedNote,
} from "./admin-conversion";
import { translationContext } from "@/test/translation-context";

const en = translationContext("en", "admin");
const funnelRows = (funnel: Parameters<typeof localizedFunnelRows>[0]) =>
  localizedFunnelRows(funnel, en.translator);
const medianLine = (medians: Parameters<typeof localizedMedianLine>[0]) =>
  localizedMedianLine(medians, en.translator);
const unrecordedNote = (
  recordedSince: string | null,
  windowDays: number,
  generatedAt: string,
) => localizedUnrecordedNote(recordedSince, windowDays, generatedAt, en);
const departuresTitle = (windowDays: number) =>
  localizedDeparturesTitle(windowDays, en.translator);

describe("funnelRows", () => {
  it("measures each step against the step before and the first", () => {
    expect(
      funnelRows([
        { key: "signed-up", count: 20 },
        { key: "confirmed-email", count: 15 },
        { key: "first-app", count: 0 },
        { key: "ranked-within-a-day", count: 0 },
      ]),
    ).toEqual([
      {
        key: "signed-up",
        label: "Signed up",
        count: 20,
        ofPrevious: null,
        ofFirst: 1,
      },
      {
        key: "confirmed-email",
        label: "Confirmed email",
        count: 15,
        ofPrevious: 0.75,
        ofFirst: 0.75,
      },
      {
        key: "first-app",
        label: "Imported a first app",
        count: 0,
        ofPrevious: 0,
        ofFirst: 0,
      },
      {
        key: "ranked-within-a-day",
        label: "Ranked within a day",
        count: 0,
        ofPrevious: null,
        ofFirst: 0,
      },
    ]);
  });

  it("puts the trial where people meet it, before the first app", () => {
    expect(
      funnelRows([
        { key: "signed-up", count: 10 },
        { key: "confirmed-email", count: 9 },
        { key: "first-app", count: 6 },
        { key: "ranked-within-a-day", count: 4 },
        { key: "trial-started", count: 8 },
        { key: "paid", count: 2 },
      ]).map((row) => [row.key, row.ofPrevious]),
    ).toEqual([
      ["signed-up", null],
      ["confirmed-email", 0.9],
      ["trial-started", 8 / 9],
      ["first-app", 0.75],
      ["ranked-within-a-day", 4 / 6],
      ["paid", 0.5],
    ]);
  });

  it("has no share where the step it divides by is empty", () => {
    expect(
      funnelRows([
        { key: "signed-up", count: 0 },
        { key: "confirmed-email", count: 0 },
      ]).map((row) => [row.ofPrevious, row.ofFirst]),
    ).toEqual([
      [null, null],
      [null, null],
    ]);
    expect(
      funnelRows([
        { key: "signed-up", count: 4 },
        { key: "ranked-within-a-day", count: 0 },
        { key: "paid", count: 1 },
      ]).map((row) => row.ofPrevious),
    ).toEqual([null, 0, null]);
  });
});

describe("trial rates", () => {
  it("rates paid trials over ended ones and has no rate before one ends", () => {
    expect(trialRate({ paid: 4, ended: 11 })).toBeCloseTo(0.3636);
    expect(trialRate({ paid: 0, ended: 0 })).toBeNull();
    expect(formatShare(4 / 11)).toBe("36%");
  });

  it("compares the window with the one before in whole points", () => {
    expect(rateChange({ paid: 4, ended: 11 }, { paid: 1, ended: 4 })).toBe(11);
    expect(rateChange({ paid: 4, ended: 11 }, { paid: 0, ended: 0 })).toBe(
      null,
    );
  });
});

describe("medianLine", () => {
  it("joins the medians it has", () => {
    expect(
      medianLine({ signupToFirstApp: 1, signupToTrial: 2.5, trialToPaid: 7 }),
    ).toBe(
      "Median 1 day to a first app · 2.5 days to a trial · 7 days from trial to paid",
    );
    expect(medianLine({ signupToFirstApp: 0.4 })).toBe(
      "Median 0.4 days to a first app",
    );
  });

  it("says nothing when no workspace reached a step", () => {
    expect(
      medianLine({
        signupToFirstApp: null,
        signupToTrial: null,
        trialToPaid: null,
      }),
    ).toBeNull();
  });
});

describe("unrecordedNote", () => {
  const generatedAt = "2026-11-20T10:00:00.000Z";

  it("names the first recorded day while it falls inside the window", () => {
    expect(unrecordedNote("2026-11-15", 30, generatedAt)).toBe(
      "Workspaces erased before Nov 15 are not counted.",
    );
  });

  it("goes quiet once recording covers the whole window", () => {
    expect(unrecordedNote("2026-09-01", 30, generatedAt)).toBeNull();
    expect(unrecordedNote(null, 30, generatedAt)).toBeNull();
  });
});

describe("departuresTitle", () => {
  it("names the window", () => {
    expect(departuresTitle(90)).toBe("Left in the last 90 days");
  });
});
