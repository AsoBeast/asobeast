import type {
  KeywordBreakdownSegment,
  KeywordWordMatch,
} from "@asobeast/shared";
import { cn } from "@/lib/utils";

const MARK_CLASS: Record<Exclude<KeywordWordMatch, "none">, string> = {
  exact: "decoration-solid",
  folded: "decoration-dotted",
};

export function MatchedText({
  segments,
  fallback,
}: {
  segments: readonly KeywordBreakdownSegment[] | null | undefined;
  fallback?: string;
}) {
  if (!segments || segments.length === 0) {
    return fallback === undefined ? null : <span>{fallback}</span>;
  }
  return segments.map((segment, index) =>
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
        {segment.match === "folded" ? (
          <>
            <span>{segment.text}</span>
            <span className="sr-only"> (accents differ)</span>
          </>
        ) : (
          segment.text
        )}
      </mark>
    ),
  );
}
