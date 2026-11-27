import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";
import { declarations } from "@/styles/token-scope";
import {
  CARD_THEME_NAMES,
  CARD_THEMES,
  type CardTheme,
  type CardThemeName,
} from "./card-themes";

const primitives = declarations(
  readFileSync(
    join(import.meta.dirname, "../../../styles/primitives.css"),
    "utf8",
  ),
  ":root",
);

type Swatch = Exclude<keyof CardTheme, "label" | "seriesFill">;

const MIRRORED: Record<CardThemeName, Record<Swatch, string>> = {
  light: {
    background: "--neutral-white",
    ink: "--neutral-ink",
    muted: "--neutral-ink-2",
    line: "--neutral-line",
    grid: "--neutral-line-2",
    tile: "--neutral-surface-2",
    series: "--brand-series",
  },
  dark: {
    background: "--neutral-dark-surface",
    ink: "--neutral-dark-ink",
    muted: "--neutral-dark-ink-2",
    line: "--neutral-dark-line",
    grid: "--neutral-dark-line-2",
    tile: "--neutral-dark-surface-2",
    series: "--brand-500",
  },
  orange: {
    background: "--brand-500",
    ink: "--brand-ink",
    muted: "--brand-ink",
    line: "--brand-700",
    grid: "--brand-600",
    tile: "--brand-600",
    series: "--brand-ink",
  },
};

const channels = (hex: string) =>
  [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

describe("card themes", () => {
  it("matches the design tokens", () => {
    for (const name of CARD_THEME_NAMES) {
      const theme = CARD_THEMES[name];
      const swatches = Object.entries(MIRRORED[name]).map(([swatch, token]) => [
        swatch,
        theme[swatch as Swatch],
        primitives[token],
      ]);
      expect(swatches.filter(([, value, token]) => value !== token)).toEqual(
        [],
      );
    }
  });

  it("fades the series colour under the line", () => {
    for (const name of CARD_THEME_NAMES) {
      const { series, seriesFill } = CARD_THEMES[name];
      expect(seriesFill).toMatch(
        new RegExp(`^rgba\\(${channels(series).join(", ")}, 0\\.\\d+\\)$`),
      );
    }
  });

  it("keeps text readable on every theme", () => {
    for (const name of CARD_THEME_NAMES) {
      const { background, ink, muted } = CARD_THEMES[name];
      expect(contrastRatio(ink, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(muted, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("names each theme for its switch", () => {
    expect(CARD_THEME_NAMES.map((name) => CARD_THEMES[name].label)).toEqual([
      "Light",
      "Dark",
      "Orange",
    ]);
  });
});
