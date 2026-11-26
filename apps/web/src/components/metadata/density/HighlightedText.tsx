import { occurrences } from "./density-marks";

interface Part {
  text: string;
  marked: boolean;
  start: number;
}

const partsOf = (text: string, row: string): Part[] => {
  const parts: Part[] = [];
  let cursor = 0;
  for (const range of occurrences(text, row)) {
    if (range.start > cursor) {
      parts.push({
        text: text.slice(cursor, range.start),
        marked: false,
        start: cursor,
      });
    }
    parts.push({
      text: text.slice(range.start, range.end),
      marked: true,
      start: range.start,
    });
    cursor = range.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), marked: false, start: cursor });
  }
  return parts;
};

export function HighlightedText({ text, row }: { text: string; row: string }) {
  return (
    <div
      role="region"
      aria-label={`Description with ${row} marked`}
      className="rounded-lg border border-border-subtle px-3 py-2"
    >
      <p dir="auto" className="text-body whitespace-pre-wrap text-foreground">
        {partsOf(text, row).map((part) =>
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
