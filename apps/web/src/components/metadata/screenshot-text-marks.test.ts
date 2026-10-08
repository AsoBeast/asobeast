import { describe, expect, it } from "vitest";
import type { KeywordCoverageRow, ScreenshotTextState } from "@asobeast/shared";
import {
  screenshotTextMark,
  showsScreenshotText,
} from "./screenshot-text-marks";

const row = (
  screenshotText?: KeywordCoverageRow["screenshotText"],
): KeywordCoverageRow => ({
  keywordId: "kw-1",
  text: "focus timer",
  bucket: null,
  fields: [{ field: "title", covered: true }],
  uncovered: false,
  ...(screenshotText === undefined ? {} : { screenshotText }),
});

const state = (status: ScreenshotTextState["status"]): ScreenshotTextState => ({
  status,
  read: 1,
  total: 2,
});

describe("screenshotTextMark", () => {
  it("marks a keyword found in a caption as covered", () => {
    expect(screenshotTextMark(row({ covered: true, positions: [1] }))).toBe(
      "covered",
    );
  });

  it("marks a keyword absent from read captions as missing", () => {
    expect(screenshotTextMark(row({ covered: false, positions: [] }))).toBe(
      "missing",
    );
  });

  it("marks a keyword whose listing was never read as unread", () => {
    expect(screenshotTextMark(row())).toBe("unread");
    expect(screenshotTextMark(row(null))).toBe("unread");
  });
});

describe("showsScreenshotText", () => {
  it("shows the column when the viewed listing has been read", () => {
    expect(showsScreenshotText([row()], state("ready"))).toBe(true);
  });

  it("shows the column when another listing judged a row from its captions", () => {
    expect(
      showsScreenshotText(
        [row(), row({ covered: true, positions: [2] })],
        state("reading"),
      ),
    ).toBe(true);
  });

  it("hides the column when no listing has been read", () => {
    expect(showsScreenshotText([row(), row(null)], state("reading"))).toBe(
      false,
    );
    expect(showsScreenshotText([row()], null)).toBe(false);
  });
});
