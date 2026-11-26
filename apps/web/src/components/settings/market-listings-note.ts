import type { MessageTranslator } from "@/i18n/translator";

export function marketListingsNote(
  count: number | undefined,
  translator: MessageTranslator,
): string | null {
  if (count === undefined || count === 0) return null;
  return translator("capacity.marketListings", { count });
}

export function localizationsNote(
  count: number | undefined,
  translator: MessageTranslator,
): string | null {
  if (count === undefined || count === 0) return null;
  return translator("capacity.localizations", { count });
}
