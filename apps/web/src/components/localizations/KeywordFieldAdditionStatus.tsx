"use client";

import { useTranslations } from "next-intl";
import {
  additionNotice,
  type KeywordFieldAddition,
  type KeywordFieldAdditionOutcome,
} from "@/lib/keyword-field-addition";
import { localizationNameInLocale } from "@/lib/localizations";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";

function receivedSentence(
  addition: KeywordFieldAddition,
  name: string,
  t: MessageTranslator,
  keywords: MessageTranslator,
): string | null {
  const notice = additionNotice(addition, name, keywords);
  if (addition.added.length === 0) return notice;
  const added = t("addition.received", {
    count: addition.added.length,
    name,
  });
  return notice ? `${added} ${notice}` : added;
}

function statusSentence(
  outcome: KeywordFieldAdditionOutcome,
  t: MessageTranslator,
  keywords: MessageTranslator,
  locale: Locale,
): string | null {
  const name = localizationNameInLocale(outcome.localization, locale);
  switch (outcome.state) {
    case "received":
      return receivedSentence(outcome.addition, name, t, keywords);
    case "managed":
      return t("addition.managed", { name });
    case "unlisted":
      return t("addition.unlisted", { name });
  }
}

export function KeywordFieldAdditionStatus({
  outcome,
}: {
  outcome: KeywordFieldAdditionOutcome;
}) {
  const t = useTranslations("localizations");
  const keywords = useTranslations("keywords");
  const locale = useAppLocale();
  const sentence = statusSentence(outcome, t, keywords, locale);
  if (!sentence) return null;
  return (
    <p
      role="status"
      className="border-b border-border px-4 py-3 text-dense text-muted-foreground"
    >
      {sentence}
    </p>
  );
}
