import { describe, expect, it } from "vitest";
import type { LineFit } from "../text-fit";
import type { FontMeasure } from "./canvas-measure";
import {
  cutSentence,
  cutSentences,
  fitStoreText,
  type CutSentence,
} from "./cut-sentence";
import { STORE_TEXT_LAYOUTS, type StoreTextLayout } from "./store-layouts";
import type { PreviewListing } from "./preview-listing";

const fits = (cutAt: number, shownWords: string[], cutWord = ""): LineFit => ({
  lines: [],
  cut: true,
  cutAt,
  shownWords,
  cutWord,
});

const whole: LineFit = {
  lines: ["GeoGuess Map Explorer"],
  cut: false,
  cutAt: 21,
  shownWords: ["GeoGuess", "Map", "Explorer"],
  cutWord: "",
};

const textOf = (sentence: CutSentence | null) =>
  sentence && `${sentence.lead}${sentence.words}${sentence.rest}`;

describe("cutSentence", () => {
  it("names the last two words before the cut on smaller iPhones", () => {
    expect(
      textOf(
        cutSentence({
          field: "title",
          store: "APP_STORE",
          device: "small",
          small: fits(12, ["GeoGuess", "Map"]),
          large: whole,
        }),
      ),
    ).toBe(
      "Cut after “GeoGuess Map” on smaller iPhones. Words after the cut still count for search.",
    );
  });

  it("says every iPhone when both frames cut at the same place", () => {
    const cut = fits(12, ["GeoGuess", "Map"]);
    expect(
      textOf(
        cutSentence({
          field: "title",
          store: "APP_STORE",
          device: "large",
          small: cut,
          large: cut,
        }),
      ),
    ).toBe(
      "Cut after “GeoGuess Map” on every iPhone. Words after the cut still count for search.",
    );
  });

  it("names the larger frame's own cut when the two differ", () => {
    expect(
      textOf(
        cutSentence({
          field: "title",
          store: "APP_STORE",
          device: "large",
          small: fits(8, ["GeoGuess"]),
          large: fits(12, ["GeoGuess", "Map"]),
        }),
      ),
    ).toBe(
      "Cut after “GeoGuess Map” on larger iPhones. Words after the cut still count for search.",
    );
  });

  it("says phones on Google Play", () => {
    expect(
      cutSentence({
        field: "title",
        store: "GOOGLE_PLAY",
        device: "small",
        small: fits(12, ["GeoGuess", "Map"]),
        large: whole,
      })?.rest,
    ).toBe("” on smaller phones. Words after the cut still count for search.");
  });

  it("answers nothing for a text that fits", () => {
    expect(
      cutSentence({
        field: "title",
        store: "APP_STORE",
        device: "small",
        small: whole,
        large: whole,
      }),
    ).toBeNull();
  });

  it("answers nothing on the larger frame when the text fits there", () => {
    expect(
      cutSentence({
        field: "title",
        store: "APP_STORE",
        device: "large",
        small: fits(12, ["GeoGuess", "Map"]),
        large: whole,
      }),
    ).toBeNull();
  });

  it("quotes the shown part of a first word cut inside itself", () => {
    expect(
      cutSentence({
        field: "title",
        store: "APP_STORE",
        device: "small",
        small: fits(9, [], "Supercali"),
        large: whole,
      })?.words,
    ).toBe("Supercali…");
  });

  it("quotes the shown part of a Chinese run with the word before it", () => {
    expect(
      cutSentence({
        field: "title",
        store: "APP_STORE",
        device: "small",
        small: fits(8, ["专注"], "番茄时钟"),
        large: whole,
      })?.words,
    ).toBe("专注 番茄时钟…");
  });

  it("answers nothing when not a single character shows", () => {
    expect(
      cutSentence({
        field: "title",
        store: "APP_STORE",
        device: "small",
        small: fits(0, []),
        large: whole,
      }),
    ).toBeNull();
  });

  it("names the field", () => {
    const sentence = (field: "subtitle" | "shortDescription") =>
      cutSentence({
        field,
        store: "APP_STORE",
        device: "small",
        small: fits(12, ["GeoGuess", "Map"]),
        large: whole,
      })?.lead;
    expect(sentence("subtitle")).toBe("Subtitle cut after “");
    expect(sentence("shortDescription")).toBe("Short description cut after “");
  });
});

const eightPerCharacter: FontMeasure = () => (text) =>
  Array.from(text).length * 8;

const listing: PreviewListing = {
  store: "APP_STORE",
  name: "GeoGuess",
  iconUrl: null,
  title: "GeoGuess Map Explorer: World Quiz",
  subtitle: "Guess places",
  shortDescription: null,
  promotionalText: null,
  description: "",
  developer: null,
  rating: null,
  screenshots: [],
};

describe("cutSentences", () => {
  it("judges each measured field of the surface on both frames", () => {
    expect(cutSentences(listing, "search", "small", eightPerCharacter)).toEqual(
      [
        {
          field: "title",
          lead: "Cut after “",
          words: "Map Explorer:",
          rest: "” on smaller iPhones. Words after the cut still count for search.",
        },
      ],
    );
  });

  it("leaves out a field the store does not draw on that surface", () => {
    const play: PreviewListing = {
      ...listing,
      store: "GOOGLE_PLAY",
      title: "Tomato Clock",
      subtitle: null,
      shortDescription: "focus ".repeat(40),
    };
    const fields = (surface: "search" | "product") =>
      cutSentences(play, surface, "small", eightPerCharacter).map(
        ({ field }) => field,
      );
    expect(fields("search")).toEqual([]);
    expect(fields("product")).toEqual(["shortDescription"]);
  });
});

describe("fitStoreText", () => {
  const tracked = (width: number): StoreTextLayout => ({
    ...STORE_TEXT_LAYOUTS.APP_STORE.product.subtitle,
    letterSpacingPx: -1,
    widths: { small: width, large: width },
  });
  const eightPerCodePoint: FontMeasure = () => (text) =>
    Array.from(text).length * 8;

  it("tracks a decomposed accent as one character", () => {
    expect(
      fitStoreText("Cafe\u0301", tracked(35.5), "small", eightPerCodePoint).cut,
    ).toBe(true);
    expect(
      fitStoreText("Cafe\u0301", tracked(36), "small", eightPerCodePoint).cut,
    ).toBe(false);
  });

  it("tracks a joined emoji as one character", () => {
    expect(
      fitStoreText(
        "Hi \u{1F469}\u200D\u{1F4BB}",
        tracked(43),
        "small",
        eightPerCodePoint,
      ).cut,
    ).toBe(true);
  });
});
