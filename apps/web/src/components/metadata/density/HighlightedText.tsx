import { markedParts } from "./density-marks";

export function HighlightedText({ text, row }: { text: string; row: string }) {
  return (
    <div
      role="region"
      aria-label={`Description with ${row} marked`}
      className="rounded-lg border border-border-subtle px-3 py-2"
    >
      <p dir="auto" className="text-body whitespace-pre-wrap text-foreground">
        {markedParts(text, row).map((part) =>
          part.marked ? (
            <mark
              key={part.start}
              className="rounded-sm bg-brand-subtle text-foreground"
            >
              {part.text}
            </mark>
          ) : (
            <span key={part.start}>{part.text}</span>
          ),
        )}
      </p>
    </div>
  );
}
