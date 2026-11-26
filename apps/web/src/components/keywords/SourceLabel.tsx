"use client";

import { useTranslations } from "next-intl";
import type { KeywordSource } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";

const SOURCE_KEYS: Record<KeywordSource, string> = {
  TITLE: "title",
  SUBTITLE: "subtitle",
  DESCRIPTION: "description",
  KEYWORD_FIELD: "keywordField",
  SUGGESTED: "suggested",
  MANUAL: "manual",
  COMPETITOR: "competitor",
};

export function sourceLabel(
  source: KeywordSource,
  t: MessageTranslator,
): string {
  return t(`sources.${SOURCE_KEYS[source]}`);
}

export function SourceLabel({ source }: { source: KeywordSource }) {
  const t = useTranslations("keywords");
  return (
    <span className="text-muted-foreground">{sourceLabel(source, t)}</span>
  );
}
