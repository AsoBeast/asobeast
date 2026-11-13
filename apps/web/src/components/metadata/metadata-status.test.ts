import type {
  AppLocalizationItem,
  MetadataAuditResult,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { keywordFieldSpace, metadataStatus } from "./metadata-status";

const localization = (
  code: AppLocalizationItem["localization"],
  charactersUsed: number,
): AppLocalizationItem => ({
  localization: code,
  origin: "manual",
  phrases: [],
  charactersUsed,
  charactersLimit: 100,
  readBy: [],
  updatedAt: null,
});

const AUDIT: MetadataAuditResult = {
  appId: "app-1",
  store: "APP_STORE",
  fields: [
    {
      field: "title",
      value: "Focus Timer",
      chars: 11,
      limit: 30,
      indexed: true,
      issues: [],
    },
    {
      field: "subtitle",
      value: "Timer timer",
      chars: 11,
      limit: 30,
      indexed: true,
      issues: [
        { rule: "repeats-title-word", severity: "warn", message: "Repeated." },
      ],
    },
  ],
  coverage: [
    {
      keywordId: "kw-1",
      text: "focus timer",
      bucket: "primary",
      fields: [{ field: "title", covered: true }],
      uncovered: false,
    },
    {
      keywordId: "kw-2",
      text: "habits",
      bucket: null,
      fields: [{ field: "title", covered: false }],
      uncovered: true,
    },
  ],
  keywordFieldSuggestion: null,
  screenshotText: { status: "ready", read: 2, total: 4 },
};

describe("keywordFieldSpace", () => {
  it("sums the characters used against every localization's limit", () => {
    expect(
      keywordFieldSpace([localization("en-US", 10), localization("pl", 20)]),
    ).toEqual({ used: 30, limit: 200 });
  });

  it("is absent without a localization", () => {
    expect(keywordFieldSpace([])).toBeNull();
  });

  it("is absent when no localization has room", () => {
    expect(
      keywordFieldSpace([{ ...localization("en-US", 0), charactersLimit: 0 }]),
    ).toBeNull();
  });
});

describe("metadataStatus", () => {
  it("counts the work left on the listing", () => {
    expect(metadataStatus(AUDIT, [localization("en-US", 10)])).toEqual({
      fieldsWithIssues: 1,
      keywords: 2,
      uncovered: 1,
      captions: { captioned: 2, total: 4 },
      keywordFieldSpace: { used: 10, limit: 100 },
    });
  });

  it("leaves the captions out until the screenshots are read", () => {
    const reading = metadataStatus(
      { ...AUDIT, screenshotText: { status: "reading", read: 1, total: 4 } },
      null,
    );
    expect(reading.captions).toBeNull();
    expect(reading.keywordFieldSpace).toBeNull();
  });

  it("leaves the captions out when no screenshot is recorded", () => {
    const empty = metadataStatus(
      { ...AUDIT, screenshotText: { status: "ready", read: 0, total: 0 } },
      null,
    );
    expect(empty.captions).toBeNull();
  });
});
