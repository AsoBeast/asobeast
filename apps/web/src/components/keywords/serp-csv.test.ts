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

const lines = (value: SerpSnapshot) => serpCsv("app-1", value).split("\r\n");

describe("serpCsv", () => {
  it("heads the file with the snapshot columns in order", () => {
    expect(lines(snapshot([]))[0]).toBe(
      "﻿keyword,capturedOn,position,app,developer,rating,ratings,role,storeAppId",
    );
  });

  it("neutralizes a formula-like app title", () => {
    expect(lines(snapshot([entry({ title: "@SUM(1)" })]))[1]).toContain(
      ",1,'@SUM(1),",
    );
  });

  it("repeats the keyword and the capture day and keeps numbers as numbers", () => {
    expect(lines(snapshot([entry()]))[1]).toBe(
      `focus timer,${capturedOn},1,Deep Work Sessions,Nordlys Labs,4.7,8400,other,555000111`,
    );
  });

  it("leaves what the store did not send empty", () => {
    expect(
      lines(
        snapshot([
          entry({ developer: null, ratingAvg: null, ratingCount: null }),
        ]),
      )[1],
    ).toBe(`focus timer,${capturedOn},1,Deep Work Sessions,,,,other,555000111`);
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
