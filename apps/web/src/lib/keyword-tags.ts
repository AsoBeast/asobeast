import {
  isKeywordTag,
  KEYWORD_TAGS_MAX,
  normalizeKeywordTag,
  SUGGESTED_KEYWORD_TAGS,
} from "@asobeast/shared";

export const VISIBLE_TAGS = 3;

export function visibleTags(
  tags: readonly string[],
  limit: number = VISIBLE_TAGS,
): { shown: string[]; hidden: number } {
  return {
    shown: tags.slice(0, limit),
    hidden: Math.max(0, tags.length - limit),
  };
}

export function tagsLabel(tags: readonly string[]): string {
  return `Tags: ${tags.join(", ")}`;
}

export type TagRefusal = "invalid" | "duplicate" | "limit";

export function addTag(
  tags: readonly string[],
  raw: string,
): { tags: string[]; refused: TagRefusal | null } {
  const tag = normalizeKeywordTag(raw);
  if (!isKeywordTag(tag)) return { tags: [...tags], refused: "invalid" };
  if (tags.includes(tag)) return { tags: [...tags], refused: "duplicate" };
  if (tags.length >= KEYWORD_TAGS_MAX) {
    return { tags: [...tags], refused: "limit" };
  }
  return { tags: [...tags, tag], refused: null };
}

export function splitTagInput(input: string): {
  complete: string[];
  rest: string;
} {
  const parts = input.split(",");
  const rest = parts.pop() ?? "";
  return { complete: parts.map((part) => part.trim()).filter(Boolean), rest };
}

export function tagSuggestions(
  present: readonly string[],
  marketTags: readonly string[],
): string[] {
  if (present.length >= KEYWORD_TAGS_MAX) return [];
  return [...new Set([...SUGGESTED_KEYWORD_TAGS, ...marketTags])].filter(
    (tag) => !present.includes(tag),
  );
}

export function tagsIn(
  rows: readonly { tags?: readonly string[] }[],
): string[] {
  return [...new Set(rows.flatMap((row) => row.tags ?? []))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export interface BulkTagChange {
  keywordId: string;
  tags: string[];
}

export type BulkTagMode = "add" | "remove";

export function bulkTagChanges(
  rows: readonly { keywordId: string; text: string; tags?: string[] }[],
  tag: string,
  mode: BulkTagMode,
): { changes: BulkTagChange[]; atLimit: string[] } {
  const changes: BulkTagChange[] = [];
  const atLimit: string[] = [];
  for (const row of rows) {
    const tags = row.tags ?? [];
    const has = tags.includes(tag);
    if (mode === "remove") {
      if (has) {
        changes.push({
          keywordId: row.keywordId,
          tags: tags.filter((entry) => entry !== tag),
        });
      }
    } else if (!has && tags.length >= KEYWORD_TAGS_MAX) {
      atLimit.push(row.text);
    } else if (!has) {
      changes.push({ keywordId: row.keywordId, tags: [...tags, tag] });
    }
  }
  return { changes, atLimit };
}
