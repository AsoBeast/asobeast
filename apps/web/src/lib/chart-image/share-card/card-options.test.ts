import { describe, expect, it } from "vitest";
import {
  DEFAULT_CARD_OPTIONS,
  parseCardOptions,
  type ShareCardOptions,
} from "./card-options";

describe("parseCardOptions", () => {
  it("reads stored options", () => {
    const stored: ShareCardOptions = {
      size: "portrait",
      theme: "dark",
      change: false,
      app: true,
      footer: false,
    };

    expect(parseCardOptions(JSON.stringify(stored))).toEqual(stored);
  });

  it("starts wide and light with every part shown", () => {
    expect(DEFAULT_CARD_OPTIONS).toEqual({
      size: "landscape",
      theme: "light",
      change: true,
      app: true,
      footer: true,
    });
  });

  it.each([
    ["nothing stored", null],
    ["bad JSON", "{"],
    ["a list", "[]"],
    ["a number", "4"],
    ["null", "null"],
  ])("falls back to the defaults for %s", (_case, raw) => {
    expect(parseCardOptions(raw)).toEqual(DEFAULT_CARD_OPTIONS);
  });

  it("falls back to the defaults for anything it does not know", () => {
    expect(
      parseCardOptions(
        JSON.stringify({
          size: "banner",
          theme: "orange",
          change: "no",
          app: false,
          footer: 0,
        }),
      ),
    ).toEqual({ ...DEFAULT_CARD_OPTIONS, theme: "orange", app: false });
  });
});
