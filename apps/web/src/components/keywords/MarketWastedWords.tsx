"use client";

import { useTranslations } from "next-intl";
import type { SplitPhrase, WastedWord } from "@asobeast/shared";
import { formatCountryInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  limitedLines,
  moreLine,
  splitPhraseLine,
  wastedWordLine,
} from "@/lib/wasted-words";

function WasteNote({
  title,
  intro,
  lines,
}: {
  title: string;
  intro: string;
  lines: readonly string[];
}) {
  const t = useTranslations("keywords");
  const { shown, hidden } = limitedLines(lines);
  return (
    <div
      role="note"
      className="flex flex-col gap-1 border-t border-border-subtle pt-3"
    >
      <p className="font-medium">{title}</p>
      <p className="text-dense text-muted-foreground">{intro}</p>
      <ul className="flex flex-col gap-1 text-dense">
        {shown.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {hidden > 0 ? (
        <p className="text-dense text-muted-foreground">
          {moreLine(hidden, t)}
        </p>
      ) : null}
    </div>
  );
}

export function MarketWastedWords({
  country,
  wastedWords,
  splitPhrases,
}: {
  country: string;
  wastedWords: readonly WastedWord[];
  splitPhrases: readonly SplitPhrase[];
}) {
  const t = useTranslations("keywords");
  const locale = useAppLocale();
  if (wastedWords.length === 0 && splitPhrases.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {wastedWords.length > 0 ? (
        <WasteNote
          title={t("wasted.wordsTitle")}
          intro={t("wasted.wordsIntro", {
            country: formatCountryInLocale(country, locale),
          })}
          lines={wastedWords.map((word) => wastedWordLine(word, t, locale))}
        />
      ) : null}
      {splitPhrases.length > 0 ? (
        <WasteNote
          title={t("wasted.splitTitle")}
          intro={t("wasted.splitIntro")}
          lines={splitPhrases.map((phrase) =>
            splitPhraseLine(phrase, t, locale),
          )}
        />
      ) : null}
    </div>
  );
}
