import { describe, expect, it } from "vitest";
import type { Release } from "@/lib/whats-new/release-notes";
import {
  firstSentence,
  openOnArrival,
  releaseAnchor,
  unreadOnArrival,
} from "./release-view";

const release = (version: string): Release => ({
  version,
  date: "2026-11-03",
  title: version,
  summary: version,
  changes: [],
});

const RELEASES = ["1.16.0", "1.15.0", "1.14.0", "1.0.0"].map(release);

describe("firstSentence", () => {
  it("keeps the text up to the first full stop", () => {
    expect(
      firstSentence("Switch to Map to see it. Press a zone to filter."),
    ).toBe("Switch to Map to see it.");
  });

  it("does not split a version number or a decimal", () => {
    expect(firstSentence("Runs on 1.16 now. Faster.")).toBe(
      "Runs on 1.16 now.",
    );
  });

  it("returns a text without a full stop whole", () => {
    expect(firstSentence("No full stop here")).toBe("No full stop here");
  });
});

describe("openOnArrival", () => {
  it("opens the newest release for a first visit", () => {
    expect([...openOnArrival(RELEASES, null, "")]).toEqual(["1.16.0"]);
  });

  it("opens every release newer than the one last read", () => {
    expect([...openOnArrival(RELEASES, "1.14.0", "")]).toEqual([
      "1.16.0",
      "1.15.0",
    ]);
  });

  it("opens the release a link names", () => {
    expect([...openOnArrival(RELEASES, "1.16.0", "release-1-0-0")]).toEqual([
      "1.16.0",
      "1.0.0",
    ]);
  });

  it("anchors a version by its dashes", () => {
    expect(releaseAnchor("1.16.0")).toBe("release-1-16-0");
  });
});

describe("unreadOnArrival", () => {
  it("marks only the newest release for a first visit", () => {
    expect([...unreadOnArrival(RELEASES, null)]).toEqual(["1.16.0"]);
  });

  it("marks every release newer than the one last read", () => {
    expect([...unreadOnArrival(RELEASES, "1.14.0")]).toEqual([
      "1.16.0",
      "1.15.0",
    ]);
    expect([...unreadOnArrival(RELEASES, "1.16.0")]).toEqual([]);
  });

  it("marks nothing when the stored value is not a version", () => {
    expect([...unreadOnArrival(RELEASES, "garbage")]).toEqual([]);
  });
});
