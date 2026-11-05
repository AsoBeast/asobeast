import { describe, expect, it } from "vitest";
import type { CompetitorGapKeyword } from "@asobeast/shared";
import { gapCsv, gapFilename } from "./gap-csv";

const NAMES = new Map([["comp-1", "Rival Focus"]]);

const row = (
  over: Partial<CompetitorGapKeyword> = {},
): CompetitorGapKeyword => ({
  keywordId: "kw-4",
  text: "productivity app",
  volume: 65,
  difficulty: 60,
  opportunity: 38,
  yourPosition: null,
  bestCompetitorPosition: 8,
  bestCompetitorId: "comp-1",
  gap: null,
  country: "us",
  ...over,
});

const lines = (csv: string) => csv.replace(/^﻿/, "").split("\r\n");

describe("gapCsv", () => {
  it("writes the columns of a gap list", () => {
    expect(lines(gapCsv("gaps", [row()], NAMES))).toEqual([
      "keyword,market,competitor,theirPosition,yourPosition,popularity,difficulty,opportunity",
      "productivity app,us,Rival Focus,8,>200,65,60,38",
    ]);
  });

  it("adds why a keyword is a threat", () => {
    expect(
      lines(
        gapCsv(
          "threats",
          [row({ yourPosition: 7, threat: "closing", competitorDelta: 2 })],
          NAMES,
        ),
      ),
    ).toEqual([
      "keyword,market,competitor,theirPosition,yourPosition,popularity,difficulty,opportunity,reason,change",
      "productivity app,us,Rival Focus,8,7,65,60,38,closing,2",
    ]);
  });

  it("adds the margin of a lead and leaves no competitor empty", () => {
    expect(
      lines(
        gapCsv(
          "lead",
          [
            row({
              yourPosition: 45,
              bestCompetitorId: null,
              bestCompetitorPosition: null,
              volume: null,
            }),
          ],
          NAMES,
        ),
      )[1],
    ).toBe("productivity app,us,,,45,,60,38,");
  });

  it("names an unknown competitor and escapes a formula", () => {
    expect(
      lines(
        gapCsv("gaps", [row({ text: "=sum", bestCompetitorId: "x" })], NAMES),
      )[1],
    ).toBe("'=sum,us,Competitor,8,>200,65,60,38");
  });
});

describe("gapFilename", () => {
  it.each([
    ["gaps", "keyword-gaps"],
    ["winnable", "winnable-keywords"],
    ["threats", "keyword-threats"],
    ["lead", "keywords-you-lead"],
  ] as const)("names the %s file", (tab, prefix) => {
    expect(gapFilename(tab, "app-1")).toMatch(
      new RegExp(`^${prefix}-app-1-\\d{4}-\\d{2}-\\d{2}\\.csv$`),
    );
  });
});
