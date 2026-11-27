import { describe, expect, it } from "vitest";
import type { SerpEntryItem, SerpSnapshot } from "@asobeast/shared";
import { serpCsv, serpFilename } from "./serp-csv";

const capturedOn = new Date().toISOString().slice(0, 10);

function entry(over: Partial<SerpEntryItem> = {}): SerpEntryItem {
  return {
    position: 1,
    storeAppId: "555000111",
    title: "Deep Work Sessions",
    developer: "Nordlys Labs",
    ratingAvg: 4.7,
    ratingCount: 8400,
    appId: null,
    isCompetitor: false,
    ...over,
  };
}

function snapshot(
  entries: SerpEntryItem[],
  date: string | null = capturedOn,
): SerpSnapshot {
  return { keywordId: "kw-1", text: "focus timer", date, entries };
}

const VIEWER = {
  appId: "app-1",
  storeAppId: "904237743",
  store: "APP_STORE",
} as const;

const lines = (value: SerpSnapshot) => serpCsv(VIEWER, value).split("\r\n");

describe("serpCsv", () => {
  it("heads the file with the snapshot columns in order", () => {
    expect(lines(snapshot([]))[0]).toBe(
      "﻿keyword,capturedOn,position,app,developer,rating,ratings,role,storeAppId,previousPosition,subtitle,keywordIn,shortDescription",
    );
  });

  it("neutralizes a formula-like app title", () => {
    expect(lines(snapshot([entry({ title: "@SUM(1)" })]))[1]).toContain(
      ",1,'@SUM(1),",
    );
  });

  it("repeats the keyword and the capture day and keeps numbers as numbers", () => {
    expect(lines(snapshot([entry()]))[1]).toBe(
      `focus timer,${capturedOn},1,Deep Work Sessions,Nordlys Labs,4.7,8400,other,555000111,,,Not in the title (subtitle not known),`,
    );
  });

  it("leaves what the store did not send empty", () => {
    expect(
      lines(
        snapshot([
          entry({ developer: null, ratingAvg: null, ratingCount: null }),
        ]),
      )[1],
    ).toBe(
      `focus timer,${capturedOn},1,Deep Work Sessions,,,,other,555000111,,,Not in the title (subtitle not known),`,
    );
  });

  it("writes the earlier position, or nothing when there was none", () => {
    const [, moved, entered, older] = lines(
      snapshot([
        entry({ previous: 4, delta: -3, movement: "up" }),
        entry({ previous: null, delta: null, movement: "new" }),
        entry(),
      ]),
    );
    expect(moved).toContain(",555000111,4,");
    expect(entered).toContain(",555000111,,");
    expect(older).toContain(",555000111,,");
  });

  it("names each app's role against the app being viewed", () => {
    const [, you, rival, sibling] = lines(
      snapshot([
        entry({ appId: "app-1" }),
        entry({ appId: "comp-1", isCompetitor: true }),
        entry({ appId: "app-2" }),
      ]),
    );
    expect(you).toContain(",you,");
    expect(rival).toContain(",competitor,");
    expect(sibling).toContain(",other,");
  });

  it("names the viewed app by its store id when the serp matched another row of it", () => {
    const [, you] = lines(
      snapshot([
        entry({
          appId: "comp-9",
          isCompetitor: true,
          storeAppId: VIEWER.storeAppId,
        }),
      ]),
    );
    expect(you).toContain(",you,");
  });
});

describe("serpCsv keyword placement", () => {
  it("writes the subtitle and where the keyword sits", () => {
    const [, split, unknown, play] = [
      ...lines(
        snapshot([
          entry({
            subtitle: "Timer for deep work",
            placement: "split",
          }),
          entry(),
        ]),
      ),
      serpCsv({ ...VIEWER, store: "GOOGLE_PLAY" }, snapshot([entry()])).split(
        "\r\n",
      )[1],
    ];

    expect(
      split.endsWith(",Timer for deep work,Split across title and subtitle,"),
    ).toBe(true);
    expect(unknown.endsWith(",,Not in the title (subtitle not known),")).toBe(
      true,
    );
    expect(
      play.endsWith(",,Not in the title (short description not known),"),
    ).toBe(true);
  });

  const playLine = (over: Partial<SerpEntryItem>) =>
    serpCsv(
      { ...VIEWER, store: "GOOGLE_PLAY" },
      snapshot([entry({ placement: "subtitle", ...over })]),
    ).split("\r\n")[1];

  it("writes the short description of a Google Play result", () => {
    expect(
      playLine({ shortDescription: "Plan your day" }).endsWith(
        ",,Short description,Plan your day",
      ),
    ).toBe(true);
  });

  it("quotes a short description that holds a comma or a line break", () => {
    expect(
      serpCsv(
        { ...VIEWER, store: "GOOGLE_PLAY" },
        snapshot([
          entry({
            placement: "subtitle",
            shortDescription: "Plan\nyour day, again",
          }),
        ]),
      ).endsWith(',Short description,"Plan\nyour day, again"'),
    ).toBe(true);
  });

  it("guards a short description that starts like a formula", () => {
    expect(
      playLine({ shortDescription: "=SUM(1)" }).endsWith(
        ",Short description,'=SUM(1)",
      ),
    ).toBe(true);
  });
});

describe("serpFilename", () => {
  it("names the file by app, keyword and capture day, or latest without one", () => {
    expect(
      serpFilename("app-1", snapshot([])).startsWith(
        `serp-app-1-kw-1-${capturedOn}-`,
      ),
    ).toBe(true);
    expect(serpFilename("app-1", snapshot([], null))).toMatch(
      /^serp-app-1-kw-1-latest-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });
});
