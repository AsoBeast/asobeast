import type {
  KeywordUpdateRequest,
  TrackedKeywordItem,
} from "@asobeast/shared";

function revertedFields(
  update: KeywordUpdateRequest,
  before: TrackedKeywordItem,
): KeywordUpdateRequest {
  return {
    ...("active" in update && { active: before.active }),
    ...("relevance" in update && { relevance: before.relevance }),
    ...("tags" in update && { tags: before.tags }),
    ...("note" in update && { note: before.note }),
  };
}

export function rollbackKeywordUpdate(
  current: TrackedKeywordItem[] | undefined,
  previous: TrackedKeywordItem[] | undefined,
  keywordId: string,
  update: KeywordUpdateRequest,
): TrackedKeywordItem[] | undefined {
  const before = previous?.find((row) => row.keywordId === keywordId);
  if (!current || !before) return current;
  const restored = revertedFields(update, before);
  return current.map((row) =>
    row.keywordId === keywordId ? { ...row, ...restored } : row,
  );
}
