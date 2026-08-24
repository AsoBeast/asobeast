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

export const ACCENT_RAMP = [
  "--accent-300",
  "--accent-400",
  "--accent-500",
  "--accent-600",
  "--accent-700",
];

export const SEMANTIC_SURFACES = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
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
  "--priority-critical",
  "--priority-high",
  "--priority-medium",
  "--priority-low",
  "--score-low",
  "--score-mid",
  "--score-high",
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

export const TEXT_PAIRS: Array<{
  label: string;
  foreground: string;
  background: string;
  floor: number;
}> = [
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
    label: "signal-up on card",
    foreground: "--signal-up",
    background: "--card",
    floor: 4.5,
  },
  {
    label: "signal-down on card",
    foreground: "--signal-down",
    background: "--card",
    floor: 4.5,
  },
  {
    label: "warning on card",
    foreground: "--warning",
    background: "--card",
    floor: 4.5,
  },
  {
    label: "priority-critical on card",
    foreground: "--priority-critical",
    background: "--card",
    floor: 4.5,
  },
  {
    label: "priority-high on card",
    foreground: "--priority-high",
    background: "--card",
    floor: 4.5,
  },
  {
    label: "priority-medium on card",
    foreground: "--priority-medium",
    background: "--card",
    floor: 4.5,
  },
  {
    label: "priority-low on card",
    foreground: "--priority-low",
    background: "--card",
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
