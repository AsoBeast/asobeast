import type { SearchWord } from "@/lib/store-preview/search-words";

const SHOWN_WORDS = 60;

export function SearchWordChips({ words }: { words: readonly SearchWord[] }) {
  if (words.length === 0) return null;
  const hidden = words.length - SHOWN_WORDS;
  return (
    <ul
      aria-label="Words search reads"
      className="flex list-none flex-wrap items-center gap-1 p-0"
    >
      {words.slice(0, SHOWN_WORDS).map(({ word, repeat }) => (
        <li
          key={word}
          title={
            repeat
              ? `Search reads “${word}” once, so this use adds nothing`
              : undefined
          }
          className="inline-flex items-center gap-1 rounded-sm border border-border bg-muted px-1.5 text-caption"
        >
          <span dir="auto">{word}</span>
          {repeat ? <span className="text-warning">repeat</span> : null}
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
