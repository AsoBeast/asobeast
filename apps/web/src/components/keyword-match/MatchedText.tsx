import type { KeywordMarkSurface, KeywordWordMatch } from "@asobeast/shared";
import { cn } from "@/lib/utils";

export interface MatchedRun {
  text: string;
  match?: KeywordWordMatch;
  surface?: KeywordMarkSurface | null;
}

type Found = Exclude<KeywordWordMatch, "none">;

const MARK_CLASS: Record<Found, string> = {
  exact: "decoration-solid",
  folded: "decoration-dotted",
};

const SURFACE_TINT: Record<KeywordMarkSurface, string> = {
  title: "bg-success-subtle decoration-success",
  subtitle: "bg-info-subtle decoration-info",
  shortDescription: "bg-info-subtle decoration-info",
  keywordField: "bg-warning-subtle decoration-warning",
};

const SURFACE_WORDS: Record<KeywordMarkSurface, string> = {
  title: "in title",
  subtitle: "in subtitle",
  shortDescription: "in short description",
  keywordField: "in keyword field",
};

export const MARK_SURFACE_NAMES: Record<KeywordMarkSurface, string> = {
  title: "Title",
  subtitle: "Subtitle",
  shortDescription: "Short description",
  keywordField: "Keyword field",
};

const markClass = (surface: KeywordMarkSurface | null, match: Found) =>
  cn(
    "rounded-sm text-foreground underline decoration-2 underline-offset-2",
    SURFACE_TINT[surface ?? "title"],
    MARK_CLASS[match],
  );

function hiddenLabel(
  surface: KeywordMarkSurface | null,
  match: Found,
): string | null {
  const words = [
    surface ? SURFACE_WORDS[surface] : null,
    match === "folded" ? "accents differ" : null,
  ].filter(Boolean);
  return words.length === 0 ? null : ` (${words.join(", ")})`;
}

export function MatchedText({
  segments,
  fallback,
}: {
  segments: readonly MatchedRun[] | null | undefined;
  fallback?: string;
}) {
  if (!segments || segments.length === 0) {
    return fallback === undefined ? null : <span>{fallback}</span>;
  }
  return segments.map(({ text, match, surface = null }, index) => {
    if (match === undefined || match === "none") {
      return <span key={index}>{text}</span>;
    }
    const label = hiddenLabel(surface, match);
    return (
      <mark key={index} className={markClass(surface, match)}>
        {label === null ? (
          text
        ) : (
          <>
            <span>{text}</span>
            <span className="sr-only">{label}</span>
          </>
        )}
      </mark>
    );
  });
}

export function MarkLegend({
  surfaces,
}: {
  surfaces: readonly KeywordMarkSurface[];
}) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {surfaces.map((surface) => (
        <mark key={surface} className={markClass(surface, "exact")}>
          {MARK_SURFACE_NAMES[surface]}
        </mark>
      ))}
    </span>
  );
}
