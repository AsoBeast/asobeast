import type { KeywordSource } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";

const VARIANT: Record<
  KeywordSource,
  "default" | "secondary" | "success" | "info" | "warning" | "outline"
> = {
  TITLE: "success",
  SUBTITLE: "info",
  DESCRIPTION: "secondary",
  KEYWORD_FIELD: "default",
  SUGGESTED: "warning",
  MANUAL: "outline",
  COMPETITOR: "secondary",
};

const LABEL: Record<KeywordSource, string> = {
  TITLE: "Title",
  SUBTITLE: "Subtitle",
  DESCRIPTION: "Description",
  KEYWORD_FIELD: "Keyword field",
  SUGGESTED: "Suggested",
  MANUAL: "Manual",
  COMPETITOR: "Competitor",
};

export function SourceBadge({ source }: { source: KeywordSource }) {
  return <Badge variant={VARIANT[source]}>{LABEL[source]}</Badge>;
}
