export type SheetClose = "back" | "clear";

export interface SheetHistory {
  opened(pushed: Promise<unknown>): void;
  closing(): SheetClose;
  cleared(): void;
}

export function sheetHistory(): SheetHistory {
  let entry: "none" | "pending" | "pushed" = "none";
  let latest = 0;
  return {
    opened(pushed) {
      entry = "pending";
      const opening = ++latest;
      void pushed.then(() => {
        if (entry === "pending" && opening === latest) entry = "pushed";
      });
    },
    closing() {
      const close = entry === "pushed" ? "back" : "clear";
      entry = "none";
      return close;
    },
    cleared() {
      entry = "none";
    },
  };
}
