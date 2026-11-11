import type { SplitPhrase, WastedWord } from "@asobeast/shared";
import { formatCountry } from "@/lib/format";
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
        <p className="text-dense text-muted-foreground">{moreLine(hidden)}</p>
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
  if (wastedWords.length === 0 && splitPhrases.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {wastedWords.length > 0 ? (
        <WasteNote
          title="Words read twice"
          intro={`${formatCountry(country)} search reads these localizations together, so each repeat spends characters without adding a word.`}
          lines={wastedWords.map(wastedWordLine)}
        />
      ) : null}
      {splitPhrases.length > 0 ? (
        <WasteNote
          title="Phrases split across localizations"
          intro="Words combine only within one localization, so search cannot match these phrases as typed."
          lines={splitPhrases.map(splitPhraseLine)}
        />
      ) : null}
    </div>
  );
}
