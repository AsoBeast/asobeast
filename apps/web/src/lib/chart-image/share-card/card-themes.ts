import type { ShareDirection } from "./headline";

export const CARD_THEME_NAMES = ["paper", "night", "dusk", "sunrise"] as const;

export type CardThemeName = (typeof CARD_THEME_NAMES)[number];

export interface CardTone {
  text: string;
  fill: string;
}

export interface CardGlow {
  x: number;
  y: number;
  reach: number;
  color: string;
}

export interface CardTheme {
  label: string;
  base: string;
  glows: readonly CardGlow[];
  dots: string;
  shadow: string;
  panel: string;
  panelLine: string;
  tile: string;
  ink: string;
  muted: string;
  grid: string;
  series: string;
  seriesFill: string;
  glow: string | null;
  chip: CardTone;
  change: Record<ShareDirection, CardTone>;
  frameInk: string;
  frameMuted: string;
}

const LIGHT_CHANGE: Record<ShareDirection, CardTone> = {
  up: { text: "#137a3a", fill: "#e4f5e9" },
  down: { text: "#c2272d", fill: "#fde6e6" },
  flat: { text: "#6b665f", fill: "#f4f2ee" },
};

const LIGHT_PANEL = {
  ink: "#1c1917",
  muted: "#6b665f",
  grid: "#eeebe6",
  series: "#d2700a",
  seriesFill: "rgba(210, 112, 10, 0.26)",
  glow: null,
  chip: { text: "#ffffff", fill: "#1c1917" },
  change: LIGHT_CHANGE,
};

const ORANGE_GLOW = "rgba(248, 152, 32, 0.45)";

export const CARD_THEMES: Record<CardThemeName, CardTheme> = {
  paper: {
    label: "Paper",
    base: "#f1ede6",
    glows: [
      { x: 0.86, y: -0.08, reach: 0.58, color: "rgba(248, 152, 32, 0.34)" },
      { x: -0.06, y: 1.08, reach: 0.46, color: "rgba(210, 112, 10, 0.12)" },
    ],
    dots: "rgba(28, 25, 23, 0.075)",
    shadow: "rgba(60, 40, 10, 0.24)",
    panel: "#ffffff",
    panelLine: "#e7e4df",
    tile: "#f4f2ee",
    ...LIGHT_PANEL,
    frameInk: "#1c1917",
    frameMuted: "#5f5a53",
  },
  night: {
    label: "Night",
    base: "#0c0b0a",
    glows: [
      { x: 0.88, y: -0.1, reach: 0.56, color: "rgba(248, 152, 32, 0.3)" },
      { x: -0.08, y: 1.1, reach: 0.44, color: "rgba(248, 152, 32, 0.1)" },
    ],
    dots: "rgba(255, 255, 255, 0.055)",
    shadow: "rgba(0, 0, 0, 0.7)",
    panel: "#141311",
    panelLine: "#2a2724",
    tile: "#1c1a17",
    ink: "#efece7",
    muted: "#a39d94",
    grid: "#221f1c",
    series: "#f89820",
    seriesFill: "rgba(248, 152, 32, 0.3)",
    glow: ORANGE_GLOW,
    chip: { text: "#141311", fill: "#efece7" },
    change: {
      up: { text: "#4ade80", fill: "#0d2a18" },
      down: { text: "#f87171", fill: "#3b1414" },
      flat: { text: "#a39d94", fill: "#221f1c" },
    },
    frameInk: "#efece7",
    frameMuted: "#a8a299",
  },
  dusk: {
    label: "Dusk",
    base: "#081c20",
    glows: [
      { x: 0.5, y: -0.2, reach: 0.7, color: "rgba(46, 125, 138, 0.55)" },
      { x: 1.04, y: 1.04, reach: 0.38, color: "rgba(248, 152, 32, 0.12)" },
    ],
    dots: "rgba(190, 235, 240, 0.065)",
    shadow: "rgba(0, 0, 0, 0.6)",
    panel: "#0e2a30",
    panelLine: "#1f474f",
    tile: "#133640",
    ink: "#f4f1ea",
    muted: "#9fb9bc",
    grid: "#1a3d44",
    series: "#f89820",
    seriesFill: "rgba(248, 152, 32, 0.18)",
    glow: ORANGE_GLOW,
    chip: { text: "#0e2a30", fill: "#f4f1ea" },
    change: {
      up: { text: "#5ee08f", fill: "#12402c" },
      down: { text: "#ff8f8f", fill: "#472324" },
      flat: { text: "#9fb9bc", fill: "#173a41" },
    },
    frameInk: "#f4f1ea",
    frameMuted: "#a6c0c3",
  },
  sunrise: {
    label: "Sunrise",
    base: "#f7a531",
    glows: [
      { x: 0.1, y: -0.1, reach: 0.62, color: "rgba(255, 226, 160, 0.95)" },
      { x: 1.04, y: 1.08, reach: 0.66, color: "rgba(214, 92, 10, 0.85)" },
    ],
    dots: "rgba(28, 20, 8, 0.07)",
    shadow: "rgba(90, 40, 0, 0.4)",
    panel: "#fffdfa",
    panelLine: "#e1d2c3",
    tile: "#f6efe5",
    ...LIGHT_PANEL,
    frameInk: "#1c1408",
    frameMuted: "#3d2a0c",
  },
};

export const isCardThemeName = (value: unknown): value is CardThemeName =>
  CARD_THEME_NAMES.some((name) => name === value);
