import { describe, expect, it } from "vitest";
import {
  matchesKeywordSearch,
  parseKeywordSearch,
  type KeywordSearch,
} from "./keyword-search";

const none: KeywordSearch = { kind: "none" };
const exact = (phrase: string): KeywordSearch => ({ kind: "exact", phrase });
const contains = (fragment: string): KeywordSearch => ({
  kind: "contains",
  fragment,
});

describe("parseKeywordSearch", () => {
  it.each([
    ["", none],
    ["habit", contains("habit")],
    ["Habit Tracker", contains("habit tracker")],
    [" pomo ", contains(" pomo ")],
    ['"habit tracker"', exact("habit tracker")],
    ["“Habit Tracker”", exact("habit tracker")],
    ["„habit tracker”", exact("habit tracker")],
    ['  "habit tracker"  ', exact("habit tracker")],
    ['"  habit   tracker "', exact("habit tracker")],
    ['"Dr. Mario"', exact("dr mario")],
    ['"café"', exact("cafe")],
    ['"', none],
    ['""', none],
    ['"   "', none],
    ['"habit tracker', contains("habit tracker")],
    ['habit tracker"', contains("habit tracker")],
    ['"habit" tracker', contains("habit tracker")],
    ['"habit""tracker"', contains("habittracker")],
  ])("reads %j", (raw, expected) => {
    expect(parseKeywordSearch(raw)).toEqual(expected);
  });
});

describe("matchesKeywordSearch", () => {
  it.each([
    [exact("habit tracker"), "habit tracker", true],
    [exact("habit tracker"), "Habit Tracker", true],
    [exact("habit tracker"), "habit tracker app", false],
    [exact("habit tracker"), "my habit tracker", false],
    [exact("habit tracker"), "habit", false],
    [exact("cafe"), "café", true],
    [exact("cafe"), "cafe", true],
    [exact("dr mario"), "dr. mario", true],
    [contains("tracker"), "habit tracker app", true],
    [contains("tracker"), "habit", false],
    [contains("cafe"), "café finder", true],
    [contains("café"), "cafe finder", true],
    [contains("?"), "what?", true],
    [contains("?"), "habit", false],
    [none, "anything", true],
  ])("matches %j against %j: %s", (search, text, expected) => {
    expect(matchesKeywordSearch(text, search)).toBe(expected);
  });
});
