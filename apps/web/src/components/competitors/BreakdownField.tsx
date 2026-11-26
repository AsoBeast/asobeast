import type { KeywordBreakdownField } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { MatchedText } from "@/components/keyword-match/MatchedText";
import { Badge } from "@/components/ui/badge";
import { fieldLabel, fieldVerdict } from "./breakdown-text";

export function BreakdownField({ field }: { field: KeywordBreakdownField }) {
  const t = useTranslations("competitors");
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption text-muted-foreground">
          {fieldLabel(field.field, t)}
        </span>
        <Badge variant={field.phrase ? "success" : "outline"}>
          {fieldVerdict(field, t)}
        </Badge>
      </div>
      {field.segments === null || field.segments.length === 0 ? null : (
        <p dir="auto" className="text-dense wrap-anywhere">
          <MatchedText segments={field.segments} />
        </p>
      )}
    </div>
  );
}
