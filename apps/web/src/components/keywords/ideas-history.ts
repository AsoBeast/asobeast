export type IdeasClose = "back" | "clear";

export interface IdeasHistory {
  opened(pushed: Promise<URLSearchParams>): void;
  switched(from: URLSearchParams, replaced: Promise<URLSearchParams>): void;
  closing(current: URLSearchParams): IdeasClose;
  cleared(): void;
}

export function createIdeasHistory(): IdeasHistory {
  let entry: string | null = null;
  let latest = 0;
  const settle = (update: Promise<URLSearchParams>, kept: boolean) => {
    const at = ++latest;
    void update.then((search) => {
      if (at === latest && kept) entry = search.toString();
    });
  };
  const forget = () => {
    entry = null;
    latest += 1;
  };
  return {
    opened(pushed) {
      entry = null;
      settle(pushed, true);
    },
    switched(from, replaced) {
      const kept = entry === from.toString();
      entry = null;
      settle(replaced, kept);
    },
    closing(current) {
      const close = entry === current.toString() ? "back" : "clear";
      forget();
      return close;
    },
    cleared: forget,
  };
}
