import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";
import { declarations } from "@/styles/token-scope";
import { CARD_SIZE_NAMES, CARD_SIZES, cardLayout } from "./card-layout";
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

const LIGHT_TOKENS = {
  ink: "--neutral-ink",
  muted: "--neutral-ink-2",
  grid: "--neutral-line-2",
  series: "--brand-series",
  "chip.fill": "--neutral-ink",
  "chip.text": "--neutral-white",
  "change.up.text": "--green-700",
  "change.up.fill": "--green-tint",
  "change.down.text": "--red-700",
  "change.down.fill": "--red-tint",
  "change.flat.text": "--neutral-ink-2",
  "change.flat.fill": "--neutral-surface-2",
};

const MIRRORED: Partial<Record<CardThemeName, Record<string, string>>> = {
  paper: {
    ...LIGHT_TOKENS,
    panel: "--neutral-white",
    panelLine: "--neutral-line",
    tile: "--neutral-surface-2",
    frameInk: "--neutral-ink",
  },
  night: {
    base: "--neutral-dark-page",
    panel: "--neutral-dark-surface",
    panelLine: "--neutral-dark-line",
    tile: "--neutral-dark-surface-2",
    ink: "--neutral-dark-ink",
    muted: "--neutral-dark-ink-2",
    grid: "--neutral-dark-line-2",
    series: "--brand-500",
    "chip.fill": "--neutral-dark-ink",
    "chip.text": "--neutral-dark-surface",
    "change.up.text": "--green-400",
    "change.up.fill": "--green-dark-tint",
    "change.down.text": "--red-400",
    "change.down.fill": "--red-dark-tint",
    "change.flat.text": "--neutral-dark-ink-2",
    "change.flat.fill": "--neutral-dark-line-2",
    frameInk: "--neutral-dark-ink",
  },
  sunrise: { ...LIGHT_TOKENS, frameInk: "--brand-ink" },
};

const valueAt = (theme: object, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        typeof value === "object" && value !== null
          ? (value as Record<string, unknown>)[key]
          : undefined,
      theme,
    );

const channels = (hex: string) =>
  [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

const rgba = (color: string): number[] => {
  const hex = /^#([\da-f]{6})$/i.exec(color)?.[1];
  if (hex) return [...channels(`#${hex}`), 1];
  return (/rgba\(([^)]+)\)/.exec(color)?.[1] ?? "").split(",").map(Number);
};

const toHex = (values: number[]) =>
  `#${values.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;

function backdropAt(
  theme: CardTheme,
  [x, y]: [number, number],
  { width, height }: { width: number; height: number },
) {
  return toHex(
    theme.glows.reduce((under, glow) => {
      const cx = glow.x * width;
      const cy = glow.y * height;
      const corner = Math.max(
        Math.hypot(cx, cy),
        Math.hypot(width - cx, cy),
        Math.hypot(cx, height - cy),
        Math.hypot(width - cx, height - cy),
      );
      const [red, green, blue, alpha] = rgba(glow.color);
      const reach = Math.min(
        Math.hypot(x - cx, y - cy) / (corner * glow.reach),
        1,
      );
      const cover = alpha * (1 - reach);
      return under.map(
        (channel, index) =>
          channel * (1 - cover) + [red, green, blue][index] * cover,
      );
    }, channels(theme.base)),
  );
}

describe("card themes", () => {
  it("names each theme for its picker", () => {
    expect(CARD_THEME_NAMES.map((name) => CARD_THEMES[name].label)).toEqual([
      "Paper",
      "Night",
      "Dusk",
      "Sunrise",
    ]);
  });

  it("takes the colours the app shares from the design tokens", () => {
    const drift = Object.entries(MIRRORED).flatMap(([name, tokens]) =>
      Object.entries(tokens).flatMap(([path, token]) => {
        const value = valueAt(CARD_THEMES[name as CardThemeName], path);
        return value === primitives[token] ? [] : [`${name}.${path}`];
      }),
    );

    expect(drift).toEqual([]);
  });

  it("fades the series colour under the line", () => {
    for (const name of CARD_THEME_NAMES) {
      const { series, seriesFill } = CARD_THEMES[name];
      expect(seriesFill).toMatch(
        new RegExp(`^rgba\\(${channels(series).join(", ")}, 0\\.\\d+\\)$`),
      );
    }
  });

  it.each(CARD_THEME_NAMES)("keeps every text readable on %s", (name) => {
    const theme = CARD_THEMES[name];
    const pairs: [string, string, string][] = [
      ["ink", theme.ink, theme.panel],
      ["muted", theme.muted, theme.panel],
      ["chip", theme.chip.text, theme.chip.fill],
      ["frame ink", theme.frameInk, theme.base],
      ["frame muted", theme.frameMuted, theme.base],
      ...Object.entries(theme.change).map(
        ([direction, tone]): [string, string, string] => [
          direction,
          tone.text,
          tone.fill,
        ],
      ),
    ];

    expect(
      pairs.filter(([, text, back]) => (contrastRatio(text, back) ?? 0) < 4.5),
    ).toEqual([]);
  });

  it.each(CARD_THEME_NAMES)(
    "keeps the credit readable over the glows of %s",
    (name) => {
      const theme = CARD_THEMES[name];
      const failing = CARD_SIZE_NAMES.flatMap((size) => {
        const { credit } = cardLayout(size, { change: true, app: true });
        const middle = credit.y + credit.height / 2;
        return [credit.x, credit.x + credit.width].flatMap((x) => {
          const back = backdropAt(theme, [x, middle], CARD_SIZES[size]);
          return [theme.frameInk, theme.frameMuted]
            .filter((text) => (contrastRatio(text, back) ?? 0) < 4.5)
            .map((text) => `${size} ${x} ${text} on ${back}`);
        });
      });

      expect(failing).toEqual([]);
    },
  );
});
