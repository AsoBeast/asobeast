import { describe, expect, it } from "vitest";
import type { AppSnapshotSummary, CompetitorItem } from "@asobeast/shared";
import { competitorCsv } from "./competitor-csv";

const capturedAt = new Date().toISOString();

const snapshot: AppSnapshotSummary = {
  id: "snap-comp-1",
  title: "Rival Focus",
  subtitle: "Deep work timer",
  summary: null,
  ratingAvg: 4.5,
  ratingCount: 12000,
  installs: null,
  price: 0,
  version: "2.1.0",
  capturedAt,
};

function competitor(over: Partial<CompetitorItem> = {}): CompetitorItem {
  return {
    id: "comp-1",
    store: "APP_STORE",
    name: "Rival Focus",
    iconUrl: null,
    latestSnapshot: snapshot,
    ...over,
  };
}

const lines = (competitors: CompetitorItem[]) =>
  competitorCsv(competitors).split("\r\n");

describe("competitorCsv", () => {
  it("heads the file with the competitor columns in order", () => {
    expect(lines([])[0]).toBe(
      "﻿competitor,store,title,subtitle,summary,rating,ratings,installs,price,version,capturedAt",
    );
  });

  it("neutralizes a formula-like name through the shared escaper", () => {
    expect(lines([competitor({ name: "=cmd|'/c calc'!A1" })])[1]).toContain(
      "'=cmd|'/c calc'!A1,APP_STORE,",
    );
  });

  it("leaves a missing snapshot and a missing name empty", () => {
    expect(lines([competitor({ latestSnapshot: null })])[1]).toBe(
      `Rival Focus,APP_STORE${",".repeat(9)}`,
    );
    expect(lines([competitor({ name: null })])[1]).toMatch(/^,APP_STORE,/);
  });

  it("writes numbers as the api returns them", () => {
    expect(lines([competitor()])[1]).toBe(
      `Rival Focus,APP_STORE,Rival Focus,Deep work timer,,4.5,12000,,0,2.1.0,${capturedAt}`,
    );
  });

  it("fills only the fields the store has", () => {
    const play = competitor({
      store: "GOOGLE_PLAY",
      name: "Tiefenfokus",
      latestSnapshot: {
        ...snapshot,
        title: "Tiefenfokus",
        subtitle: null,
        summary: "Tiefe Arbeitsblöcke, klare Pausen",
        installs: 1200000,
      },
    });
    expect(lines([play])[1]).toBe(
      `Tiefenfokus,GOOGLE_PLAY,Tiefenfokus,,"Tiefe Arbeitsblöcke, klare Pausen",4.5,12000,1200000,0,2.1.0,${capturedAt}`,
    );
  });
});
