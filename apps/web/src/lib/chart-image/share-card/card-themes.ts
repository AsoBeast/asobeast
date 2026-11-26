export const CARD_THEME_NAMES = ["light", "dark", "orange"] as const;

export type CardThemeName = (typeof CARD_THEME_NAMES)[number];

export interface CardTone {
  text: string;
  fill: string;
}

export interface CardTheme {
  label: string;
  panel: string;
  ink: string;
  muted: string;
  line: string;
  grid: string;
  tile: string;
  series: string;
  seriesFill: string;
  glow: string | null;
  chip: CardTone;
}

export const CARD_THEMES: Record<CardThemeName, CardTheme> = {
  light: {
    label: "Light",
    panel: "#ffffff",
    ink: "#1c1917",
    muted: "#6b665f",
    line: "#e7e4df",
    grid: "#eeebe6",
    tile: "#f4f2ee",
    series: "#d2700a",
    seriesFill: "rgba(210, 112, 10, 0.16)",
    glow: null,
    chip: { text: "#ffffff", fill: "#1c1917" },
  },
  dark: {
    label: "Dark",
    panel: "#141311",
    ink: "#efece7",
    muted: "#a39d94",
    line: "#2a2724",
    grid: "#221f1c",
    tile: "#1c1a17",
    series: "#f89820",
    seriesFill: "rgba(248, 152, 32, 0.16)",
    glow: "rgba(248, 152, 32, 0.45)",
    chip: { text: "#141311", fill: "#efece7" },
  },
  orange: {
    label: "Orange",
    panel: "#f89820",
    ink: "#1c1408",
    muted: "#1c1408",
    line: "#a8520a",
    grid: "#e88010",
    tile: "#e88010",
    series: "#1c1408",
    seriesFill: "rgba(28, 20, 8, 0.12)",
    glow: null,
    chip: { text: "#f89820", fill: "#1c1408" },
  },
};

export const isCardThemeName = (value: unknown): value is CardThemeName =>
  CARD_THEME_NAMES.some((name) => name === value);
