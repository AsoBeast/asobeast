"use client";

import { useTranslations } from "next-intl";
import type { SupportAccessEntry, SupportOutcome } from "@asobeast/shared";
import { SheetSection } from "@/components/layout/SheetSection";
import type { MessageTranslator } from "@/i18n/translator";
import { supportActionLabel, supportOutcomeLabel } from "@/lib/admin-support";
import { formatDateTimeInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { Locale } from "@/lib/locale";
import { SectionNote } from "./SectionNote";

const OUTCOME_TONE: Record<SupportOutcome, string> = {
  attempted: "text-muted-foreground",
  succeeded: "text-foreground",
  failed: "text-destructive",
};

function AccessEntry({
  entry,
  translator,
  locale,
}: {
  entry: SupportAccessEntry;
  translator: MessageTranslator;
  locale: Locale;
}) {
  return (
    <li className="flex flex-col gap-1 py-2 text-dense">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium">
          {supportActionLabel(entry.action, translator)}
        </span>
        <span className={OUTCOME_TONE[entry.outcome]}>
          {supportOutcomeLabel(entry.outcome, translator)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-2 text-caption text-muted-foreground">
        <span translate="no" className="wrap-anywhere">
          {entry.actorEmail}
        </span>
        <span>{formatDateTimeInLocale(entry.at, locale)}</span>
      </div>
      {entry.reason ? (
        <blockquote
          dir="auto"
          className="border-l-2 border-border pl-3 wrap-anywhere"
        >
          {entry.reason}
        </blockquote>
      ) : null}
      {entry.detail ? (
        <p className="text-caption wrap-anywhere text-muted-foreground">
          {entry.detail}
        </p>
      ) : null}
    </li>
  );
}

export function WorkspaceAccessLog({
  entries,
}: {
  entries: SupportAccessEntry[];
}) {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  return (
    <SheetSection title={t("support.access.title")}>
      <ul
        aria-label={t("support.access.title")}
        className="flex flex-col divide-y divide-border-subtle"
      >
        {entries.map((entry, index) => (
          <AccessEntry
            key={`${entry.at}-${entry.action}-${index}`}
            entry={entry}
            translator={t}
            locale={locale}
          />
        ))}
      </ul>
      <SectionNote>{t("support.access.note")}</SectionNote>
    </SheetSection>
  );
}
