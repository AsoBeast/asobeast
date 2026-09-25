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
