import { describe, expect, it } from "vitest";
import { headerIndex, parseCsv } from "./tokenize";

const cellsOf = (text: string) =>
  parseCsv(text).records.map((record) => record.cells);

describe("parseCsv", () => {
  it("reads a comma file into records with their physical lines", () => {
    expect(parseCsv("keyword,country\r\nhabit,us\r\nstreak,pl\r\n")).toEqual({
      delimiter: ",",
      records: [
        { line: 1, cells: ["keyword", "country"] },
        { line: 2, cells: ["habit", "us"] },
        { line: 3, cells: ["streak", "pl"] },
      ],
    });
  });

  it("prefers the semicolon of a file whose decimals use commas", () => {
    const table = parseCsv("keyword;volume\nhabit;3,5\nstreak;4,1\n");

    expect(table.delimiter).toBe(";");
    expect(table.records[1].cells).toEqual(["habit", "3,5"]);
  });

  it("detects a tab delimited file", () => {
    expect(parseCsv("keyword\tcountry\nhabit\tus\n").delimiter).toBe("\t");
  });

  it("detects a pipe delimited file", () => {
    expect(parseCsv("keyword|country\nhabit|us\n").delimiter).toBe("|");
  });

  it("keeps commas, quotes and line breaks inside a quoted field", () => {
    const table = parseCsv(
      'keyword,note\r\n"a, b","say ""hi""\r\nbye"\r\nnext,x',
    );

    expect(table.records.map((record) => record.cells)).toEqual([
      ["keyword", "note"],
      ["a, b", 'say "hi"\nbye'],
      ["next", "x"],
    ]);
    expect(table.records[2].line).toBe(4);
  });

  it.each([
    ["LF", "a,b\nc,d"],
    ["CR", "a,b\rc,d"],
    ["CRLF", "a,b\r\nc,d"],
    ["a trailing LF", "a,b\nc,d\n"],
  ])("ends a record at %s", (_name, text) => {
    expect(cellsOf(text)).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("drops blank lines and keeps the physical line of what follows", () => {
    const table = parseCsv("keyword\n\n\nhabit\n  \nstreak");

    expect(table.records).toEqual([
      { line: 1, cells: ["keyword"] },
      { line: 4, cells: ["habit"] },
      { line: 6, cells: ["streak"] },
    ]);
  });

  it("leaves a single column of phrases whole when the commas are not consistent", () => {
    const table = parseCsv("habit tracker, streak\nfocus\nsleep\n");

    expect(table.delimiter).toBeNull();
    expect(table.records.map((record) => record.cells)).toEqual([
      ["habit tracker, streak"],
      ["focus"],
      ["sleep"],
    ]);
  });

  it("treats a quote inside an unquoted field as text and runs an unclosed quote to the end", () => {
    expect(cellsOf('ab"c,d\n')).toEqual([['ab"c', "d"]]);
    expect(cellsOf('a,"b\nc')).toEqual([["a", "b\nc"]]);
  });

  it("keeps a trailing delimiter as an empty cell", () => {
    expect(cellsOf("a,b,\nc,d,\n")).toEqual([
      ["a", "b", ""],
      ["c", "d", ""],
    ]);
  });

  it("drops a byte order mark that survived decoding", () => {
    expect(cellsOf("\uFEFFkeyword,country\nhabit,us")[0]).toEqual([
      "keyword",
      "country",
    ]);
  });

  it("detects the delimiter of a file with one record", () => {
    expect(parseCsv("a;b;c").delimiter).toBe(";");
  });

  it("reads a hand written file by its header when later rows leave trailing cells out", () => {
    expect(parseCsv("keyword,country\nhabit tracker,us\nfocus timer")).toEqual({
      delimiter: ",",
      records: [
        { line: 1, cells: ["keyword", "country"] },
        { line: 2, cells: ["habit tracker", "us"] },
        { line: 3, cells: ["focus timer"] },
      ],
    });
  });

  it("reads a file by its header when a later row carries an extra cell", () => {
    const table = parseCsv(
      "Keyword;Market\nhabit tracker;us;extra\nfocus timer\n",
    );

    expect(table.delimiter).toBe(";");
    expect(table.records.map((record) => record.cells)).toEqual([
      ["Keyword", "Market"],
      ["habit tracker", "us", "extra"],
      ["focus timer"],
    ]);
  });

  it("anchors on a header only when it names a keyword column", () => {
    expect(
      parseCsv("name,country\nhabit tracker,us\nfocus timer").delimiter,
    ).toBeNull();
  });

  it("counts a bare CR inside a quoted field as a physical line", () => {
    const table = parseCsv('keyword,note\r"a\rb",x\rnext,y');

    expect(table.records[1].cells).toEqual(["a\nb", "x"]);
    expect(table.records[2]).toEqual({ line: 4, cells: ["next", "y"] });
  });

  it("ignores a record the sample cuts short when it detects the delimiter", () => {
    const cell = "x".repeat(6_000);
    const text = [`${cell},a`, `${cell},b`, `${cell},c`, `${cell},d`].join(
      "\n",
    );

    expect(text.length).toBeGreaterThan(16_384);
    expect(parseCsv(text).delimiter).toBe(",");
  });

  it("goes in the order comma, semicolon, tab, pipe when two delimiters fit equally", () => {
    expect(parseCsv("a,b;c\nd,e;f\n").delimiter).toBe(",");
  });
});

describe("headerIndex", () => {
  const recordsOf = (text: string) => parseCsv(text).records;

  it("U-HEAD-01 is the first record when it is the header", () => {
    expect(headerIndex(recordsOf("keyword,country\nhabit,us\n"))).toBe(0);
  });

  it("U-HEAD-02 skips the narrower lines above a header", () => {
    expect(
      headerIndex(
        recordsOf("Report\nApp,Import Lab\nKeyword,Position,Total\nhabit,4,9"),
      ),
    ).toBe(2);
  });

  it("U-HEAD-03 does not read a data row as a header below rows as wide as itself", () => {
    expect(headerIndex(recordsOf("habit,us\nquery,pl\nfocus,gb"))).toBe(0);
  });

  it("U-HEAD-04 is the first record when no record names a keyword column", () => {
    expect(headerIndex(recordsOf("name,country\nhabit,us"))).toBe(0);
    expect(headerIndex([])).toBe(0);
  });

  it("U-HEAD-05 looks no further than the sample of ten records", () => {
    const lines = Array.from({ length: 12 }, (_, index) => `note ${index}`);

    expect(
      headerIndex(recordsOf([...lines, "Keyword,Position", "a,1"].join("\n"))),
    ).toBe(0);
  });
});

describe("parseCsv with lines above the header", () => {
  it("U-HEAD-06 finds the delimiter of the header, not of the lines above it", () => {
    const table = parseCsv(
      "Keywords report; made by hand\nKeyword,Position\nhabit,4\nfocus,9\n",
    );

    expect(table.delimiter).toBe(",");
    expect(table.records[0].cells).toEqual(["Keywords report; made by hand"]);
  });
});
