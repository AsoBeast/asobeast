import type { KeywordClass, KeywordClassSource } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";

const BADGES = {
  ownBrand: { letter: "B", words: "Brand keyword", variant: "info" },
  competitorBrand: {
    letter: "CB",
    words: "Competitor brand keyword",
    variant: "outline",
  },
} as const;

export function KeywordClassBadge({
  keywordClass,
  source,
}: {
  keywordClass: KeywordClass | undefined;
  source: KeywordClassSource | undefined;
}) {
  if (keywordClass === undefined || keywordClass === "generic") return null;
  const { letter, words, variant } = BADGES[keywordClass];
  const label = source === "owner" ? `${words}, set by you` : words;
  return (
    <Badge variant={variant} title={label} className="relative shrink-0">
      <span aria-hidden>{letter}</span>
      <span className="sr-only">{label}</span>
    </Badge>
  );
}
