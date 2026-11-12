import { InfoTip } from "@/components/ui/info-tip";

const KEYWORD_TYPES_GUIDE = "https://docs.asobeast.com/concepts/keyword-types";

export function KeywordTypeTip() {
  return (
    <InfoTip
      label="About keyword types"
      title="Keyword types"
      summary="Own brand: the keyword holds the name of your app or its developer. Competitor brand: it holds the name of a competitor or of another app that dominates the results. Generic: everything else. A type you set yourself is marked as set by you."
    >
      <a
        href={KEYWORD_TYPES_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="link-underline"
      >
        Read about keyword types
      </a>
    </InfoTip>
  );
}
