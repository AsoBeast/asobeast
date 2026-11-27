import { countMaxLengthChars } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enKeywords from "../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export interface TextLimit {
  used: number;
  over: number;
}

export function textLimit(text: string, limit: number): TextLimit {
  const used = countMaxLengthChars(text);
  return { used, over: Math.max(0, used - limit) };
}

export function limitCounterText(
  counter: TextLimit,
  limit: number,
  t: MessageTranslator = english,
): string {
  const base = t("limits.counter", {
    used: counter.used,
    limit,
  });
  return counter.over > 0
    ? t("limits.over", { base, over: counter.over })
    : base;
}
