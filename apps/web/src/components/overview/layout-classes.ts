export const PULSE_STRIP = "rounded-none border-0";

export const PULSE_COLUMNS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-1 @lg/overview:grid-cols-3",
  4: "grid-cols-2 @3xl/overview:grid-cols-4",
};

export const SPLIT_ROW =
  "grid gap-6 @5xl/overview:grid-cols-12 print:grid-cols-1 [&>*]:min-w-0 print:[&>*]:col-span-1";

export const SPLIT_WIDE = "@5xl/overview:col-span-7";

export const SPLIT_NARROW = "flex flex-col gap-6 @5xl/overview:col-span-5";

export const LIST_ROW =
  "relative h-10 items-center rounded-md text-dense outline-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:h-9";

export const LIST_HEAD = "text-label text-faint-foreground";

export const FOOTER_LINK =
  "inline-flex min-h-6 items-center text-foreground underline decoration-faint-foreground underline-offset-4 hover:decoration-foreground print:hidden";
