import { type CardSizeName, isCardSizeName } from "./card-layout";
import { type CardThemeName, isCardThemeName } from "./card-themes";

export interface ShareCardOptions {
  size: CardSizeName;
  theme: CardThemeName;
  change: boolean;
  app: boolean;
}

export type CardSwitch = "change" | "app";

export const SHARE_CARD_PREFERENCE = "asobeast.shareCard";

export const DEFAULT_CARD_OPTIONS: ShareCardOptions = {
  size: "landscape",
  theme: "paper",
  change: true,
  app: true,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function storedObject(raw: string | null): Record<string, unknown> {
  if (raw === null) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

const flag = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

export function parseCardOptions(raw: string | null): ShareCardOptions {
  const stored = storedObject(raw);
  const defaults = DEFAULT_CARD_OPTIONS;
  return {
    size: isCardSizeName(stored.size) ? stored.size : defaults.size,
    theme: isCardThemeName(stored.theme) ? stored.theme : defaults.theme,
    change: flag(stored.change, defaults.change),
    app: flag(stored.app, defaults.app),
  };
}
