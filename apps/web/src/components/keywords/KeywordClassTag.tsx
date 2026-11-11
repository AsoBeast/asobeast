import type { KeywordClass, KeywordClassSource } from "@asobeast/shared";

const MARKS = {
  ownBrand: { letter: "B", words: "Brand keyword" },
  competitorBrand: { letter: "CB", words: "Competitor brand keyword" },
} as const;

export function KeywordClassTag({
  keywordClass,
  source,
}: {
  keywordClass: KeywordClass | undefined;
  source: KeywordClassSource | undefined;
}) {
  if (keywordClass === undefined || keywordClass === "generic") return null;
  const { letter, words } = MARKS[keywordClass];
  const label = source === "owner" ? `${words}, set by you` : words;
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
