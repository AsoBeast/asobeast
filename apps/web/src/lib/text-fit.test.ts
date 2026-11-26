import { describe, expect, it } from "vitest";
import { clipText, fitLines, wrapWords, type Measure } from "./text-fit";

const tenPerCharacter: Measure = (text) => Array.from(text).length * 10;

describe("clipText", () => {
  it("keeps a text that fits", () => {
    expect(clipText("focus", 50, tenPerCharacter)).toBe("focus");
  });

  it("cuts to the room and ends with an ellipsis", () => {
    expect(clipText("focus timer", 60, tenPerCharacter)).toBe("focus…");
  });

  it("never splits a surrogate pair", () => {
    expect(clipText("𠮷𠮷𠮷𠮷", 30, tenPerCharacter)).toBe("𠮷𠮷…");
  });

  it("returns only the ellipsis when nothing fits", () => {
    expect(clipText("focus", 5, tenPerCharacter)).toBe("…");
  });
});

describe("wrapWords", () => {
  it("wraps at the last word that fits", () => {
    expect(wrapWords("aa bb cc dd", 50, tenPerCharacter)).toEqual([
      "aa bb",
      "cc dd",
    ]);
  });

  it("keeps a single long word on its own line", () => {
    expect(wrapWords("abcdefghij kl", 50, tenPerCharacter)).toEqual([
      "abcdefghij",
      "kl",
    ]);
  });

  it("returns no lines for an empty text", () => {
    expect(wrapWords("", 50, tenPerCharacter)).toEqual([]);
  });
});

const ADVANCES: readonly [RegExp, number][] = [
  [/\p{Extended_Pictographic}/u, 18],
  [/[぀-ヿ㐀-鿿]/u, 16],
  [/[֐-ۿ]/u, 7],
  [/ /u, 4],
];

const fakeMeasure: Measure = (text) =>
  Array.from(text).reduce(
    (width, character) =>
      width + (ADVANCES.find(([pattern]) => pattern.test(character))?.[1] ?? 8),
    0,
  );

const oneLine = (width: number) => ({ width, lines: 1 });

describe("fitLines", () => {
  it("keeps a text that fits on one line", () => {
    expect(fitLines("Focus Timer", oneLine(120), fakeMeasure)).toEqual({
      lines: ["Focus Timer"],
      cut: false,
      cutAt: 11,
      shownWords: ["Focus", "Timer"],
      cutWord: "",
    });
  });

  it("cuts a Latin title after the last whole word that fits with an ellipsis", () => {
    expect(
      fitLines("GeoGuess Map Explorer Pro", oneLine(120), fakeMeasure),
    ).toEqual({
      lines: ["GeoGuess Map…"],
      cut: true,
      cutAt: 12,
      shownWords: ["GeoGuess", "Map"],
      cutWord: "",
    });
  });

  it("fills two lines before cutting", () => {
    expect(
      fitLines(
        "Habit Tracker Daily Goals Planner",
        { width: 100, lines: 2 },
        fakeMeasure,
      ),
    ).toEqual({
      lines: ["Habit Tracker", "Daily Goals…"],
      cut: true,
      cutAt: 25,
      shownWords: ["Habit", "Tracker", "Daily", "Goals"],
      cutWord: "",
    });
  });

  it("breaks a word wider than the line at code points", () => {
    expect(fitLines("Supercalifragilistic", oneLine(60), fakeMeasure)).toEqual({
      lines: ["Superc…"],
      cut: true,
      cutAt: 6,
      shownWords: [],
      cutWord: "Superc",
    });
  });

  it("continues a broken word on the next line", () => {
    expect(
      fitLines("Supercalifragilistic", { width: 60, lines: 3 }, fakeMeasure),
    ).toMatchObject({
      lines: ["Superca", "lifragi", "listic"],
      cut: false,
    });
  });

  it("breaks a Chinese title at code points", () => {
    expect(
      fitLines("番茄专注时钟番茄专注时钟", oneLine(100), fakeMeasure),
    ).toEqual({
      lines: ["番茄专注时…"],
      cut: true,
      cutAt: 5,
      shownWords: [],
      cutWord: "番茄专注时",
    });
  });

  it("cuts a Japanese title with a space between runs at the space first", () => {
    expect(
      fitLines("集中タイマー 勉強アプリ", oneLine(120), fakeMeasure),
    ).toEqual({
      lines: ["集中タイマー…"],
      cut: true,
      cutAt: 6,
      shownWords: ["集中タイマー"],
      cutWord: "",
    });
  });

  it("keeps an Arabic title in logical order", () => {
    expect(fitLines("مؤقت التركيز اليومي", oneLine(90), fakeMeasure)).toEqual({
      lines: ["مؤقت التركيز…"],
      cut: true,
      cutAt: 12,
      shownWords: ["مؤقت", "التركيز"],
      cutWord: "",
    });
  });

  it("keeps a Hebrew title in logical order", () => {
    expect(fitLines("טיימר מיקוד יומי", oneLine(82), fakeMeasure)).toEqual({
      lines: ["טיימר מיקוד…"],
      cut: true,
      cutAt: 11,
      shownWords: ["טיימר", "מיקוד"],
      cutWord: "",
    });
  });

  it("never splits an emoji", () => {
    const fit = fitLines("🍅🍅🍅🍅🍅🍅", oneLine(60), fakeMeasure);
    expect(fit.lines).toEqual(["🍅🍅…"]);
    expect(fit.cutWord).toBe("🍅🍅");
    expect(fit.cutAt).toBe(2);
  });

  it("answers an exact fit without a cut", () => {
    expect(fitLines("Focus Timer", oneLine(84), fakeMeasure)).toMatchObject({
      lines: ["Focus Timer"],
      cut: false,
    });
  });

  it("drops the space left before the ellipsis", () => {
    expect(fitLines("Focus Timer Pro", oneLine(92), fakeMeasure)).toMatchObject(
      {
        lines: ["Focus Timer…"],
        cut: true,
      },
    );
    expect(fitLines("abcdefgh a b", oneLine(80), fakeMeasure).lines).toEqual([
      "abcdefgh…",
    ]);
  });

  it("treats an empty text as nothing to cut", () => {
    expect(fitLines("   ", oneLine(100), fakeMeasure)).toEqual({
      lines: [],
      cut: false,
      cutAt: 0,
      shownWords: [],
      cutWord: "",
    });
  });

  it("collapses runs of spaces as the store does", () => {
    expect(
      fitLines(" Focus  \n Timer ", oneLine(84), fakeMeasure),
    ).toMatchObject({ lines: ["Focus Timer"], cut: false, cutAt: 11 });
  });
});

describe("fitLines without wrapping", () => {
  it("clips a line that never wraps across the whole text", () => {
    expect(
      fitLines(
        "abc defghijk",
        { width: 10, lines: 1, wrap: "none" },
        (text) => Array.from(text).length,
      ),
    ).toEqual({
      lines: ["abc defgh…"],
      cut: true,
      cutAt: 9,
      shownWords: ["abc"],
      cutWord: "defgh",
    });
  });

  it("keeps a line that never wraps when the whole text fits", () => {
    expect(
      fitLines(
        "abc defghijk",
        { width: 12, lines: 1, wrap: "none" },
        (text) => Array.from(text).length,
      ).cut,
    ).toBe(false);
  });
});
