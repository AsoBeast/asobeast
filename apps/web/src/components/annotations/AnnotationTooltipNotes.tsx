import type { AppAnnotationItem } from "@asobeast/shared";
import { formatCountry } from "@/lib/format";

function AnnotationNote({ annotation }: { annotation: AppAnnotationItem }) {
  const meta = [
    annotation.tag,
    annotation.market === null ? null : formatCountry(annotation.market),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5 font-medium text-foreground">
        <svg aria-hidden width="14" height="8" viewBox="0 0 14 8">
          <line
            x1="0"
            y1="4"
            x2="14"
            y2="4"
            stroke="var(--info)"
            strokeWidth="2"
            strokeDasharray="6 3"
          />
        </svg>
        {annotation.label}
      </span>
      {meta ? <span className="pl-4 text-muted-foreground">{meta}</span> : null}
    </div>
  );
}

export function AnnotationTooltipNotes({
  annotations,
}: {
  annotations: readonly AppAnnotationItem[];
}) {
  if (annotations.length === 0) return null;

  return (
    <div className="grid gap-1.5 border-t border-border/50 pt-1.5">
      {annotations.map((annotation) => (
        <AnnotationNote key={annotation.id} annotation={annotation} />
      ))}
    </div>
  );
}
