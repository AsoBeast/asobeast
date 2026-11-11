export const PULSE_STRIP = "rounded-none border-0";

export const PULSE_COLUMNS: Record<number, string> = {
  3: "grid-cols-1 @lg/overview:grid-cols-3",
  4: "grid-cols-2 @3xl/overview:grid-cols-4",
};

export const SPLIT_ROW =
  "grid gap-6 @5xl/overview:grid-cols-12 print:grid-cols-1 [&>*]:min-w-0 print:[&>*]:col-span-1";

export const SPLIT_WIDE = "@5xl/overview:col-span-7";

export const SPLIT_NARROW = "flex flex-col gap-6 @5xl/overview:col-span-5";
