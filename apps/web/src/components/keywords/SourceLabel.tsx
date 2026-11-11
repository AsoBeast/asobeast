import type { KeywordSource } from "@asobeast/shared";

export const SOURCE_LABELS: Record<KeywordSource, string> = {
  TITLE: "Title",
  SUBTITLE: "Subtitle",
  DESCRIPTION: "Description",
  KEYWORD_FIELD: "Keyword field",
  SUGGESTED: "Suggested",
  MANUAL: "Manual",
  COMPETITOR: "Competitor",
};

export function SourceLabel({ source }: { source: KeywordSource }) {
  return <span className="text-muted-foreground">{SOURCE_LABELS[source]}</span>;
}
