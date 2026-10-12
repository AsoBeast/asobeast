import type { ReactNode } from "react";
import { Copy, Unlink } from "lucide-react";
import type { SplitPhrase, WastedWord } from "@asobeast/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCountry } from "@/lib/format";
import {
  limitedLines,
  moreLine,
  splitPhraseLine,
  wastedWordLine,
} from "@/lib/wasted-words";

function WasteNote({
  icon,
  title,
  intro,
  lines,
}: {
  icon: ReactNode;
  title: string;
  intro: string;
  lines: readonly string[];
}) {
  const { shown, hidden } = limitedLines(lines);
  return (
    <Alert role="note" variant="warning">
      {icon}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{intro}</p>
        <ul className="flex flex-col gap-1">
          {shown.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {hidden > 0 ? <p>{moreLine(hidden)}</p> : null}
      </AlertDescription>
    </Alert>
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
    <div className="flex flex-col gap-2">
      {wastedWords.length > 0 ? (
        <WasteNote
          icon={<Copy aria-hidden />}
          title="Words read twice"
          intro={`${formatCountry(country)} search reads these localizations together, so each repeat spends characters without adding a word.`}
          lines={wastedWords.map(wastedWordLine)}
        />
      ) : null}
      {splitPhrases.length > 0 ? (
        <WasteNote
          icon={<Unlink aria-hidden />}
          title="Phrases split across localizations"
          intro="Words combine only within one localization, so search cannot match these phrases as typed."
          lines={splitPhrases.map(splitPhraseLine)}
        />
      ) : null}
    </div>
  );
}
