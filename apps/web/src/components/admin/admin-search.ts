import type { MessageTranslator } from "@/i18n/translator";

export type AdminNoun = "workspace" | "account" | "app";

export function adminNounLabel(
  noun: AdminNoun,
  count: number,
  translator: MessageTranslator,
): string {
  return translator("common.noun", { noun, count });
}

export function adminSearchLabel(
  noun: AdminNoun,
  translator: MessageTranslator,
): string {
  return translator(`common.search.${noun}`);
}
