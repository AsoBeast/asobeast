import { describe, expect, it } from "vitest";
import {
  compareVersions,
  hasUnseenRelease,
  latestShown,
  parseVersion,
  RELEASE_KINDS,
  releasesUpTo,
  type Release,
  type Version,
} from "./release-notes";
import { RELEASES } from "./releases";

const release = (version: string, date: string): Release => ({
  version,
  date,
  title: "Headline",
  summary: "Summary.",
  changes: [{ kind: "new", title: "Change", text: "Text." }],
});

const FIXTURE = [
  release("1.16.0", "2026-11-05"),
  release("1.15.0", "2026-10-31"),
  release("1.14.0", "2026-10-25"),
];

const version = (label: string): Version => {
  const parsed = parseVersion(label);
  if (!parsed) throw new Error(`unreadable version ${label}`);
  return parsed;
};

const sentences = (each: Release): string[] => [
  each.title,
  each.summary,
  ...each.changes.flatMap((change) => [change.title, change.text]),
];

const CODE_LIKE = /[`_/<>{}]|#\d|—|–| - /;
const IDENTIFIER =
  /\b(?!(?:iPhone|iPad|iPod|iOS|iPadOS|iCloud|macOS|watchOS|tvOS|visionOS)\b)[a-z]+[A-Z][A-Za-z]*\b/;
const LOWERCASE_NAME = /asobeast/;

const looksLikeCode = (text: string) =>
  CODE_LIKE.test(text) || IDENTIFIER.test(text) || LOWERCASE_NAME.test(text);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("parseVersion", () => {
  it("reads a version with or without a v", () => {
    expect(parseVersion("1.15.0")).toEqual([1, 15, 0]);
    expect(parseVersion("v1.15.0")).toEqual([1, 15, 0]);
  });

  it("ignores a suffix after the patch", () => {
    expect(parseVersion("1.16.0-rc.1")).toEqual([1, 16, 0]);
  });

  it("refuses what is not a version", () => {
    expect(parseVersion("")).toBeNull();
    expect(parseVersion("dev")).toBeNull();
    expect(parseVersion("1.16")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("compares numbers, not text", () => {
    expect(
      compareVersions(version("1.10.0"), version("1.2.0")),
    ).toBeGreaterThan(0);
  });

  it("puts a major above any minor", () => {
    expect(
      compareVersions(version("2.0.0"), version("1.99.9")),
    ).toBeGreaterThan(0);
  });

  it("answers zero for the same version", () => {
    expect(compareVersions(version("1.15.0"), version("v1.15.0"))).toBe(0);
  });
});

describe("releasesUpTo", () => {
  it("hides a release newer than the running version", () => {
    expect(releasesUpTo(FIXTURE, "1.15.0").map((each) => each.version)).toEqual(
      ["1.15.0", "1.14.0"],
    );
  });

  it("shows the minor a patch belongs to", () => {
    expect(releasesUpTo(FIXTURE, "1.14.5")[0]?.version).toBe("1.14.0");
  });

  it("shows every release when the running version cannot be read", () => {
    expect(releasesUpTo(FIXTURE, null)).toHaveLength(3);
    expect(releasesUpTo(FIXTURE, "dev")).toHaveLength(3);
  });
});

describe("latestShown", () => {
  it("is the newest release the running version shows", () => {
    expect(latestShown(FIXTURE, "1.15.0")).toBe("1.15.0");
  });

  it("is null when no release is shown", () => {
    expect(latestShown(FIXTURE, "0.0.1")).toBeNull();
  });
});

describe("hasUnseenRelease", () => {
  it("is quiet without a release to show", () => {
    expect(hasUnseenRelease(null, null)).toBe(false);
  });

  it("is quiet until the stored value is read", () => {
    expect(hasUnseenRelease("1.15.0", undefined)).toBe(false);
  });

  it("flags a viewer who never opened the page", () => {
    expect(hasUnseenRelease("1.15.0", null)).toBe(true);
  });

  it("flags an older seen release", () => {
    expect(hasUnseenRelease("1.15.0", "1.14.0")).toBe(true);
  });

  it("is quiet for the same release", () => {
    expect(hasUnseenRelease("1.15.0", "1.15.0")).toBe(false);
  });

  it("is quiet after a downgrade", () => {
    expect(hasUnseenRelease("1.15.0", "1.16.0")).toBe(false);
  });

  it("flags an unreadable seen value", () => {
    expect(hasUnseenRelease("1.15.0", "garbage")).toBe(true);
  });
});

describe("RELEASES", () => {
  it("lists versions newest first without repeats", () => {
    RELEASES.slice(1).forEach((each, index) => {
      expect(
        compareVersions(
          version(RELEASES[index]!.version),
          version(each.version),
        ),
      ).toBeGreaterThan(0);
    });
  });

  it("dates every release with a valid day that never increases", () => {
    RELEASES.forEach((each, index) => {
      expect(each.date).toMatch(ISO_DATE);
      expect(new Date(`${each.date}T00:00:00Z`).toISOString()).toContain(
        each.date,
      );
      if (index > 0) {
        expect(each.date <= RELEASES[index - 1]!.date).toBe(true);
      }
    });
  });

  it("ends with the first release", () => {
    expect(RELEASES.at(-1)?.version).toBe("1.0.0");
  });

  it("gives every release a headline, a summary and changes", () => {
    for (const each of RELEASES) {
      expect(each.title.trim()).not.toBe("");
      expect(each.summary.trim()).not.toBe("");
      expect(each.changes.length).toBeGreaterThan(0);
      for (const change of each.changes) {
        expect(RELEASE_KINDS).toContain(change.kind);
        expect(change.title.trim()).not.toBe("");
        expect(change.text.trim()).not.toBe("");
      }
    }
  });

  it("names every feature 1.16.0 shows", () => {
    const titles = RELEASES.find(
      (each) => each.version === "1.16.0",
    )?.changes.map((change) => change.title);

    expect(titles).toEqual(
      expect.arrayContaining([
        "Discovered keywords",
        "Search keywords with or without accents",
        "Keyword gaps, threats and where you lead",
        "Share of voice",
        "Alerts page",
        "Essential alerts from the first day",
        "Rating drop and review spike alerts",
        "Alerts when an app leaves the store",
      ]),
    );
  });

  it("names every change of a release once", () => {
    const repeated = RELEASES.filter(
      (each) =>
        new Set(each.changes.map((change) => change.title)).size !==
        each.changes.length,
    ).map((each) => each.version);
    expect(repeated).toEqual([]);
  });

  it("refuses identifiers and allows the names of Apple's platforms", () => {
    expect(
      [
        "Uses apiFetch now.",
        "Kept in localStorage.",
        "Set `x`.",
        "See #12.",
      ].map(looksLikeCode),
    ).toEqual([true, true, true, true]);
    expect(
      ["Works on iPhone, iPad and iOS.", "Runs on macOS.", "AsoBeast."].map(
        looksLikeCode,
      ),
    ).toEqual([false, false, false]);
  });

  it("is written without code, paths, issue numbers or dashes", () => {
    const offending = RELEASES.flatMap(sentences).filter(looksLikeCode);
    expect(offending).toEqual([]);
  });

  it("ends every summary and change text with a full stop", () => {
    const unfinished = RELEASES.flatMap((each) => [
      each.summary,
      ...each.changes.map((change) => change.text),
    ]).filter((text) => !text.endsWith("."));
    expect(unfinished).toEqual([]);
  });

  it("keeps headlines and change titles short and unpunctuated", () => {
    const titles = RELEASES.flatMap((each) => [
      each.title,
      ...each.changes.map((change) => change.title),
    ]);
    expect(titles.filter((title) => title.endsWith("."))).toEqual([]);
    expect(titles.filter((title) => title.length > 60)).toEqual([]);
  });
});
