import type { Locale } from "@/lib/locale";

export type MessageTranslator = {
  bivarianceHack(key: string, values?: Record<string, string | number>): string;
}["bivarianceHack"];

export interface TranslationContext {
  translator: MessageTranslator;
  locale: Locale;
}
