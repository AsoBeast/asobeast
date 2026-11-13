import type { AppLocalizationOrigin } from "@asobeast/shared";

const ORIGIN_WORDS: Partial<Record<AppLocalizationOrigin, string>> = {
  home: "Home",
  detected: "Detected",
};

export function OriginMark({ origin }: { origin: AppLocalizationOrigin }) {
  const word = ORIGIN_WORDS[origin];
  if (word === undefined) return null;
  return (
    <span className="text-caption font-normal text-faint-foreground">
      {word}
    </span>
  );
}
