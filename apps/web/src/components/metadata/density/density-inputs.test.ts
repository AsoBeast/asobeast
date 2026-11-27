import type { KeywordCoverageRow, MetadataAuditResult } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { densityContext } from "./density-inputs";

const row = (
  text: string,
  fields: KeywordCoverageRow["fields"],
): KeywordCoverageRow => ({
  keywordId: text,
  text,
  bucket: null,
  fields,
  uncovered: false,
});

const audit = (
  store: MetadataAuditResult["store"],
  coverage: KeywordCoverageRow[],
): MetadataAuditResult => ({
  appId: "app-1",
  store,
  fields: [],
  coverage,
  keywordFieldSuggestion: null,
});

describe("densityContext", () => {
  it("reads the tracked keywords and the language of an App Store listing", () => {
    const context = densityContext(
      audit("APP_STORE", [
        row("focus timer", [{ field: "title", covered: true }]),
        row("pomodoro", [{ field: "subtitle", covered: false }]),
      ]),
      "us",
      "en-GB",
      { name: "Focus Flow", country: "us" },
    );

    expect(context).toEqual({
      store: "APP_STORE",
      language: "en",
      appName: "Focus Flow",
      tracked: ["focus timer", "pomodoro"],
      searched: null,
    });
  });

  it("counts the tracked keywords the description holds on Google Play", () => {
    const context = densityContext(
      audit("GOOGLE_PLAY", [
        row("vêtements", [{ field: "description", covered: true }]),
        row("mode", [{ field: "description", covered: false }]),
        row("vinted", [{ field: "title", covered: true }]),
      ]),
      "fr",
      undefined,
      { name: "Vinted", country: "fr" },
    );

    expect(context.language).toBe("fr");
    expect(context.searched).toEqual({ held: 1, tracked: 3 });
  });

  it("reads the language of a native default listing", () => {
    const context = densityContext(audit("APP_STORE", []), "pl", undefined, {
      name: "Dzienniczek",
      country: "pl",
      defaultLocalization: "pl",
    });

    expect(context.language).toBe("pl");
  });
});
