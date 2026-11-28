import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import type { SearchWord } from "@/lib/store-preview/search-words";

const SHOWN_WORDS = 60;

export function SearchWordChips({
  label,
  words,
}: {
  label: string;
  words: readonly SearchWord[];
}) {
  if (words.length === 0) return null;
  const hidden = words.length - SHOWN_WORDS;
  return (
    <ul
      aria-label={label}
      className="flex list-none flex-wrap items-center gap-1 p-0"
    >
      {words.slice(0, SHOWN_WORDS).map(({ word, readFrom }) => (
        <li
          key={word}
          title={
            readFrom
              ? `Search already reads “${word}” from the ${METADATA_FIELD_LABELS[readFrom].toLowerCase()}`
              : undefined
          }
          className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-sm border border-border bg-muted px-1.5 text-caption"
        >
          <span dir="auto" className="min-w-0 wrap-anywhere">
            {word}
          </span>
          {readFrom ? (
            <span className="shrink-0 text-warning">repeat</span>
          ) : null}
        </li>
      ))}
      {hidden > 0 ? (
        <li className="text-caption text-muted-foreground">
          <span>{`and ${hidden} more`}</span>
        </li>
      ) : null}
    </ul>
  );
}
