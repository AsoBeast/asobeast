import { createTranslator } from "next-intl";
import { catalogs, type MessageNamespace } from "@/i18n/messages";
import type { TranslationContext } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";

export function translationContext(
  locale: Locale,
  namespace: MessageNamespace,
): TranslationContext {
  return {
    locale,
    translator: createTranslator({
      locale,
      namespace,
      messages: catalogs[locale] as Parameters<
        typeof createTranslator
      >[0]["messages"],
      timeZone: "UTC",
    }),
  };
}
