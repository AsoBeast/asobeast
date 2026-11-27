import type { SerpEntryItem, Store } from "@asobeast/shared";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("keywordInspector");
  const { label, note } = keywordInLabel(entry, store, t);
  return (
    <p className="text-caption text-muted-foreground">
      <span>{t("serp.summary.keywordIn")} </span>
      <span className="text-foreground">{label}</span>
      {note === null ? null : <span>{`, ${note}`}</span>}
      {isOutlier(entry, store, role) ? (
        <Badge variant="outline" className="ml-2 align-middle">
          {t("serp.row.outlier")}
        </Badge>
      ) : null}
    </p>
  );
}
