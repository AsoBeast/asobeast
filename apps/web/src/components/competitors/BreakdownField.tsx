import type { KeywordBreakdownField, KeywordWordMatch } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fieldLabel, fieldVerdict } from "./breakdown-text";

const MARK_CLASS: Record<Exclude<KeywordWordMatch, "none">, string> = {
  exact: "decoration-solid",
  folded: "decoration-dotted",
};

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
          {field.segments.map((segment, index) =>
            segment.match === "none" ? (
              <span key={index}>{segment.text}</span>
            ) : (
              <mark
                key={index}
                className={cn(
                  "rounded-sm bg-success-subtle text-foreground underline decoration-success decoration-2 underline-offset-2",
                  MARK_CLASS[segment.match],
                )}
              >
                {segment.text}
                {segment.match === "folded" ? (
                  <span className="sr-only"> (accents differ)</span>
                ) : null}
              </mark>
            ),
          )}
        </p>
      )}
    </div>
  );
}
