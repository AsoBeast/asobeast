export const LEDE = "max-w-[70ch] text-body text-muted-foreground";

const PULSE_GRID = "grid-cols-2 @3xl/dashboard:grid-cols-4";

export const PULSE_STRIP = `${PULSE_GRID} rounded-none border-0`;

export const SPLIT_ROW = "grid gap-6 @5xl/dashboard:grid-cols-12 [&>*]:min-w-0";

export const SPLIT_WIDE = "@5xl/dashboard:col-span-7";

export const SPLIT_NARROW = "@5xl/dashboard:col-span-5";

export const PANEL_HEADER = "min-h-[47px] content-center";

export const PANEL_ACTION = "row-span-1 self-center";

export const APPS_HEADING_ID = "apps-heading";

export const PANEL_FOOTER =
  "border-t border-border px-4 py-3 text-caption text-faint-foreground";

export const APPS_PANEL = {
  section:
    "flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card",
  header:
    "flex min-h-[59px] flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3",
} as const;

export const APPS_SECTION = {
  section: "flex min-w-0 flex-col gap-4",
  header: "flex flex-wrap items-center justify-between gap-x-3 gap-y-2",
} as const;

export const APP_GRID =
  "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(20rem,100%),1fr))]";
