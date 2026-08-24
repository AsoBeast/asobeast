import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

const rows = (body: string) => `﻿keyword\r\n${body}`;

describe("toCsv", () => {
  it("prefixes the header with a bom", () => {
    expect(toCsv(["keyword"], [])).toBe("﻿keyword");
  });

  it.each([
    ["=SUM(1,1)", `"'=SUM(1,1)"`],
    ["+1", "'+1"],
    ["-3", "'-3"],
    ["@command", "'@command"],
    ["\tlead", "'\tlead"],
    ["\rlead", `"'\rlead"`],
  ])("neutralizes the formula-like value %s", (value, expected) => {
    expect(toCsv(["keyword"], [[value]])).toBe(rows(expected));
  });

  it("leaves negative numbers and unicode untouched", () => {
    expect(toCsv(["keyword"], [[-3], ["café"]])).toBe(rows("-3\r\ncafé"));
  });

  it("quotes separators, quotes and newlines", () => {
    expect(toCsv(["keyword"], [["a,b"], ['a"b'], ["a\nb"]])).toBe(
      rows(`"a,b"\r\n"a""b"\r\n"a\nb"`),
    );
  });

  it("renders null as an empty field", () => {
    expect(toCsv(["keyword"], [[null]])).toBe(rows(""));
  });
});
