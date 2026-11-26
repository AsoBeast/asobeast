import type { SerpEntryItem, Store } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { isOutlier, keywordInLabel } from "./placement-labels";
import type { SerpRole } from "./serp-csv";

export function KeywordInLine({
  entry,
  store,
  role,
}: {
  entry: SerpEntryItem;
  store: Store;
  role: SerpRole;
}) {
  const { label, note } = keywordInLabel(entry, store);
  return (
    <p className="text-caption text-muted-foreground">
      <span>Keyword in </span>
      <span className="text-foreground">{label}</span>
      {note === null ? null : <span>{`, ${note}`}</span>}
      {isOutlier(entry, store, role) ? (
        <Badge variant="outline" className="ml-2 align-middle">
          Outlier
        </Badge>
      ) : null}
    </p>
  );
}
