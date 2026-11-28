import { describe, expect, it } from "vitest";
import type { DraftWastedWord } from "@asobeast/shared";
import { searchWords } from "./search-words";

const repeated: DraftWastedWord = {
  word: "habit",
  reason: "repeated",
  fields: ["title", "subtitle"],
};

describe("searchWords", () => {
  it("normalizes and splits like coverage", () => {
    expect(
      searchWords("APP_STORE", "title", "Habit-Tracker: Daily!", []),
    ).toEqual([
      { word: "habit", readFrom: null },
      { word: "tracker", readFrom: null },
      { word: "daily", readFrom: null },
    ]);
  });

  it("lists each word once in first appearance order", () => {
    expect(
      searchWords("APP_STORE", "subtitle", "Goals daily goals Daily", [])?.map(
        ({ word }) => word,
      ),
    ).toEqual(["goals", "daily"]);
  });

  it("marks a repeated word only where search reads it a second time", () => {
    expect(
      searchWords("APP_STORE", "subtitle", "Habit goals", [repeated]),
    ).toEqual([
      { word: "habit", readFrom: "title" },
      { word: "goals", readFrom: null },
    ]);
    expect(
      searchWords("APP_STORE", "title", "Habit goals", [repeated]),
    ).toEqual([
      { word: "habit", readFrom: null },
      { word: "goals", readFrom: null },
    ]);
  });

  it("reads a word repeated in the subtitle and keyword field from the subtitle", () => {
    expect(
      searchWords("APP_STORE", "keywordField", "habit", [
        { ...repeated, fields: ["keywordField", "subtitle"] },
      ]),
    ).toEqual([{ word: "habit", readFrom: "subtitle" }]);
  });

  it("reads a Google Play repeat from the short description before the description", () => {
    expect(
      searchWords("GOOGLE_PLAY", "description", "habit", [
        { ...repeated, fields: ["description", "shortDescription"] },
      ]),
    ).toEqual([{ word: "habit", readFrom: "shortDescription" }]);
  });

  it("marks nothing for a field the repeat does not name", () => {
    expect(
      searchWords("APP_STORE", "keywordField", "habit", [repeated]),
    ).toEqual([{ word: "habit", readFrom: null }]);
  });

  it("marks nothing for a word the preview calls unused", () => {
    expect(
      searchWords("APP_STORE", "subtitle", "habit", [
        { ...repeated, reason: "unused", fields: ["subtitle"] },
      ]),
    ).toEqual([{ word: "habit", readFrom: null }]);
  });

  it("marks nothing before the preview answers", () => {
    expect(
      searchWords("APP_STORE", "title", "Habit Habit", [])?.some(
        ({ readFrom }) => readFrom !== null,
      ),
    ).toBe(false);
  });

  it("answers nothing for a field the store does not search", () => {
    expect(searchWords("APP_STORE", "description", "Habit", [])).toBeNull();
    expect(searchWords("APP_STORE", "promotionalText", "Habit", [])).toBeNull();
  });

  it("reads the Google Play description, which the store searches", () => {
    expect(searchWords("GOOGLE_PLAY", "description", "Habit", [])).toEqual([
      { word: "habit", readFrom: null },
    ]);
  });

  it("keeps a Chinese run as one chip", () => {
    expect(searchWords("APP_STORE", "title", "番茄专注时钟", [])).toEqual([
      { word: "番茄专注时钟", readFrom: null },
    ]);
  });

  it("reads the keyword field by its commas", () => {
    expect(
      searchWords("APP_STORE", "keywordField", "focus,timer", [])?.map(
        ({ word }) => word,
      ),
    ).toEqual(["focus", "timer"]);
  });

  it("answers no words for an empty field", () => {
    expect(searchWords("APP_STORE", "subtitle", "  ", [])).toEqual([]);
  });
});
