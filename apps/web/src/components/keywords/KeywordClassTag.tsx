"use client";

import { createTranslator } from "next-intl";
import type { KeywordClass, KeywordClassSource } from "@asobeast/shared";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

const MARKS = {
  ownBrand: { letter: "B", key: "ownBrand" },
  competitorBrand: { letter: "CB", key: "competitorBrand" },
} as const;

export function KeywordClassTag({
  keywordClass,
  source,
  t = english,
}: {
  keywordClass: KeywordClass | undefined;
  source: KeywordClassSource | undefined;
  t?: MessageTranslator;
}) {
  if (keywordClass === undefined || keywordClass === "generic") return null;
  const { letter, key } = MARKS[keywordClass];
  const words = t(`classTag.${key}`);
  const label =
    source === "owner" ? t("classTag.owner", { type: words }) : words;
  return (
    <span
      data-slot="keyword-class"
      data-class={keywordClass}
      title={label}
      className="relative inline-flex h-[18px] shrink-0 items-center rounded-sm border border-border px-1 text-tick font-medium text-muted-foreground"
    >
      <span aria-hidden>{letter}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
