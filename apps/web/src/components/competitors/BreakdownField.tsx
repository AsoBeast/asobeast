import type { KeywordBreakdownField } from "@asobeast/shared";
import { MatchedText } from "@/components/keyword-match/MatchedText";
import { Badge } from "@/components/ui/badge";
import { fieldLabel, fieldVerdict } from "./breakdown-text";

export function BreakdownField({ field }: { field: KeywordBreakdownField }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {fieldLabel(field.field)}
        </span>
        <Badge variant={field.phrase ? "success" : "outline"}>
          {fieldVerdict(field)}
        </Badge>
      </div>
      {field.segments === null || field.segments.length === 0 ? null : (
        <p dir="auto" className="text-sm wrap-anywhere">
          <MatchedText segments={field.segments} />
        </p>
      )}
    </div>
  );
}
