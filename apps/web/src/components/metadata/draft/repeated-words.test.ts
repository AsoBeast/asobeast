import { describe, expect, it } from "vitest";
import type { LintIssue } from "@asobeast/shared";
import {
  groupLintIssues,
  removeRepeats,
  repeatedWords,
} from "./repeated-words";

const repeat = (
  word: string,
  field: "title" | "subtitle" = "subtitle",
): LintIssue => ({
  rule: `repeats-${field}-word`,
  severity: "error",
  message: `"${word}" already appears in the ${field}.`,
  offendingText: word,
});

const underUsed: LintIssue = {
  rule: "under-utilized",
  severity: "warn",
  message: "Only 21 of 100 characters used.",
};

describe("groupLintIssues", () => {
  it("folds the repeats of one field into one line where the first stood", () => {
    expect(
      groupLintIssues([
        underUsed,
        repeat("study"),
        repeat("timer", "title"),
        repeat("timer"),
        repeat("deep"),
      ]),
    ).toEqual([
      underUsed,
      {
        rule: "repeats-subtitle-word",
        severity: "error",
        message: '"study", "timer", and "deep" already appear in the subtitle.',
      },
      repeat("timer", "title"),
    ]);
  });

  it("keeps a single repeat as the server wrote it", () => {
    expect(groupLintIssues([repeat("timer", "title")])).toEqual([
      repeat("timer", "title"),
    ]);
  });

  it("counts the words past six", () => {
    const words = ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"];
    expect(groupLintIssues(words.map((word) => repeat(word)))[0]?.message).toBe(
      '"a1", "b2", "c3", "d4", "e5", "f6" and 2 more already appear in the subtitle.',
    );
  });

  it("keeps other rules and severities apart", () => {
    const warned = { ...repeat("deep"), severity: "warn" as const };
    expect(groupLintIssues([repeat("study"), warned])).toEqual([
      repeat("study"),
      warned,
    ]);
  });
});

describe("repeatedWords", () => {
  it("collects the words the title or subtitle already hold", () => {
    expect(
      repeatedWords([underUsed, repeat("study"), repeat("timer", "title")]),
    ).toEqual(new Set(["study", "timer"]));
  });
});

describe("removeRepeats", () => {
  it("drops repeated words and the terms they empty", () => {
    expect(
      removeRepeats(
        "study timer,deep work,planner",
        new Set(["study", "timer", "deep", "work"]),
      ),
    ).toEqual({ value: "planner", words: 4, chars: 22 });
  });

  it("keeps the rest of a term and leaves untouched terms as typed", () => {
    expect(
      removeRepeats("focus app, habit tracker", new Set(["focus"])),
    ).toEqual({ value: "app, habit tracker", words: 1, chars: 6 });
  });

  it("reads a word the way search does", () => {
    expect(removeRepeats("Timer!,clock", new Set(["timer"]))).toEqual({
      value: "clock",
      words: 1,
      chars: 7,
    });
  });

  it("takes a repeated word out of a hyphenated part", () => {
    expect(removeRepeats("Habit-Tracker,timer", new Set(["habit"]))).toEqual({
      value: "Tracker,timer",
      words: 1,
      chars: 6,
    });
  });

  it("changes nothing without a repeat", () => {
    expect(removeRepeats("focus,timer", new Set())).toEqual({
      value: "focus,timer",
      words: 0,
      chars: 0,
    });
  });
});
