import { contrastRatio } from "@/lib/contrast";

export const NEUTRAL_RAMP = [
  "--neutral-50",
  "--neutral-100",
  "--neutral-200",
  "--neutral-300",
  "--neutral-400",
  "--neutral-500",
  "--neutral-600",
  "--neutral-700",
  "--neutral-800",
  "--neutral-850",
  "--neutral-900",
  "--neutral-950",
  "--neutral-white",
];

export const BRAND_RAMP = ["--brand-500", "--brand-600", "--brand-700"];

export const BLUE_RAMP = ["--blue-400", "--blue-700"];

export const SEMANTIC_SURFACES = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--primary-hover",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--border",
  "--input",
  "--ring",
];

export const RESERVED_SIGNALS = [
  "--signal-up",
  "--signal-up-subtle",
  "--signal-down",
  "--signal-down-subtle",
  "--success",
  "--success-subtle",
  "--warning",
  "--warning-subtle",
  "--info",
  "--priority-critical",
  "--priority-high",
  "--priority-medium",
  "--priority-low",
  "--score-low",
  "--score-mid",
  "--score-high",
  "--grade-strong",
  "--grade-strong-subtle",
  "--grade-fair",
  "--grade-fair-subtle",
  "--grade-weak",
  "--grade-weak-subtle",
  "--grade-poor",
  "--grade-poor-subtle",
];

export const RANK_BANDS = [
  "--rank-band-1",
  "--rank-band-2",
  "--rank-band-3",
  "--rank-band-4",
  "--rank-band-5",
];

export const CHART_SERIES = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--chart-6",
  "--chart-7",
  "--chart-8",
];

export const SIDEBAR_TOKENS = [
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
];

export interface TextPair {
  label: string;
  foreground: string;
  background: string;
  floor: number;
  tint?: number;
}

const GRADE_TEXT = [
  "--grade-strong",
  "--grade-fair",
  "--grade-weak",
  "--grade-poor",
];

const STATUS_TEXT = [
  "--success",
  "--warning",
  "--destructive",
  "--info",
  "--signal-up",
  "--signal-down",
  "--priority-critical",
  "--priority-high",
  "--priority-medium",
  "--priority-low",
  ...GRADE_TEXT,
];

const SUBTLE_TEXT = ["--success", "--warning", "--signal-up", "--signal-down"];

const GAP_ROW_TEXT = ["--foreground", "--muted-foreground", ...GRADE_TEXT];

const TINTED_TEXT = [
  { token: "--destructive", tint: 5 },
  { token: "--destructive", tint: 10 },
  { token: "--destructive", tint: 12 },
  { token: "--info", tint: 10 },
  { token: "--priority-critical", tint: 10 },
  { token: "--priority-high", tint: 10 },
  { token: "--priority-medium", tint: 10 },
  { token: "--priority-low", tint: 10 },
];

const textOn = (foreground: string, background: string): TextPair => ({
  label: `${foreground.slice(2)} on ${background.slice(2)}`,
  foreground,
  background,
  floor: 4.5,
});

export const TEXT_PAIRS: TextPair[] = [
  {
    label: "foreground on background",
    foreground: "--foreground",
    background: "--background",
    floor: 4.5,
  },
  {
    label: "foreground on card",
    foreground: "--card-foreground",
    background: "--card",
    floor: 4.5,
  },
  {
    label: "muted-foreground on background",
    foreground: "--muted-foreground",
    background: "--background",
    floor: 4.5,
  },
  {
    label: "muted-foreground on card",
    foreground: "--muted-foreground",
    background: "--card",
    floor: 4.5,
  },
  {
    label: "muted-foreground on muted",
    foreground: "--muted-foreground",
    background: "--muted",
    floor: 4.5,
  },
  {
    label: "primary-foreground on primary",
    foreground: "--primary-foreground",
    background: "--primary",
    floor: 4.5,
  },
  {
    label: "primary-foreground on primary-hover",
    foreground: "--primary-foreground",
    background: "--primary-hover",
    floor: 4.5,
  },
  {
    label: "sidebar-primary-foreground on sidebar-primary",
    foreground: "--sidebar-primary-foreground",
    background: "--sidebar-primary",
    floor: 4.5,
  },
  {
    label: "popover-foreground on popover",
    foreground: "--popover-foreground",
    background: "--popover",
    floor: 4.5,
  },
  {
    label: "sidebar-foreground on sidebar",
    foreground: "--sidebar-foreground",
    background: "--sidebar",
    floor: 4.5,
  },
  {
    label: "muted-foreground on sidebar",
    foreground: "--muted-foreground",
    background: "--sidebar",
    floor: 4.5,
  },
  {
    label: "muted-foreground on sidebar-accent",
    foreground: "--muted-foreground",
    background: "--sidebar-accent",
    floor: 4.5,
  },
  {
    label: "sidebar-primary on sidebar-accent",
    foreground: "--sidebar-primary",
    background: "--sidebar-accent",
    floor: 3,
  },
  ...STATUS_TEXT.flatMap((token) =>
    ["--card", "--muted"].map((background) => textOn(token, background)),
  ),
  ...SUBTLE_TEXT.map((token) => textOn(token, `${token}-subtle`)),
  ...GAP_ROW_TEXT.map((token) => textOn(token, "--warning-subtle")),
  ...GRADE_TEXT.map((token) => textOn("--foreground", `${token}-subtle`)),
  textOn("--muted-foreground", "--success-subtle"),
  ...TINTED_TEXT.flatMap(({ token, tint }) =>
    ["--card", "--background", "--popover"].map((background) => ({
      ...textOn(token, background),
      label: `${token.slice(2)} on its ${tint}% tint over ${background.slice(2)}`,
      tint,
    })),
  ),
  {
    label: "info on background",
    foreground: "--info",
    background: "--background",
    floor: 4.5,
  },
  {
    label: "score-low on card",
    foreground: "--score-low",
    background: "--card",
    floor: 4.5,
  },
  {
    label: "score-mid on card",
    foreground: "--score-mid",
    background: "--card",
    floor: 4.5,
  },
  {
    label: "score-high on card",
    foreground: "--score-high",
    background: "--card",
    floor: 4.5,
  },
  {
    label: "ring on background",
    foreground: "--ring",
    background: "--background",
    floor: 3,
  },
  {
    label: "ring on card",
    foreground: "--ring",
    background: "--card",
    floor: 3,
  },
  ...CHART_SERIES.map((token) => ({
    label: `${token.slice(2)} on background`,
    foreground: token,
    background: "--background",
    floor: 3,
  })),
  ...RANK_BANDS.map((token) => ({
    label: `${token.slice(2)} on background`,
    foreground: token,
    background: "--background",
    floor: 3,
  })),
];

export function pairContrast(
  { foreground, background, tint }: TextPair,
  read: (token: string) => string,
): number | null {
  const surface =
    tint === undefined
      ? read(background)
      : `color-mix(in srgb, ${read(foreground)} ${tint}%, ${read(background)})`;
  return contrastRatio(read(foreground), surface);
}
