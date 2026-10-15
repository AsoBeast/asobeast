import {
  CATEGORY_COLLECTIONS,
  type CategoryCollection,
  type ChartFollowItem,
  type ChartKey,
} from "@asobeast/shared";

export type ChartCategory = Omit<ChartKey, "collection">;

export interface FollowedCategory extends ChartCategory {
  follows: ChartFollowItem[];
}

export function chartCategoryOf({
  store,
  country,
  genre,
  device,
}: ChartCategory): ChartCategory {
  return { store, country, genre, device };
}

export function chartCategoryKey(category: ChartCategory): string {
  return [
    category.store,
    category.country,
    category.genre,
    category.device,
  ].join("~");
}

function byKind(a: ChartFollowItem, b: ChartFollowItem): number {
  return (
    CATEGORY_COLLECTIONS.indexOf(a.collection) -
    CATEGORY_COLLECTIONS.indexOf(b.collection)
  );
}

function newestOf(follows: readonly ChartFollowItem[]): number {
  return Math.max(...follows.map((follow) => Date.parse(follow.createdAt)));
}

export function categoryFollows(
  category: ChartCategory,
  follows: readonly ChartFollowItem[],
): ChartFollowItem[] {
  const key = chartCategoryKey(category);
  return follows
    .filter((follow) => chartCategoryKey(follow) === key)
    .sort(byKind);
}

export function missingKinds(
  category: ChartCategory,
  follows: readonly ChartFollowItem[],
): CategoryCollection[] {
  const followed = new Set(
    categoryFollows(category, follows).map((follow) => follow.collection),
  );
  return CATEGORY_COLLECTIONS.filter((kind) => !followed.has(kind));
}

export function followedCategories(
  follows: readonly ChartFollowItem[],
): FollowedCategory[] {
  const groups = new Map<string, FollowedCategory>();
  for (const follow of follows) {
    const key = chartCategoryKey(follow);
    const group = groups.get(key);
    if (group) group.follows.push(follow);
    else groups.set(key, { ...chartCategoryOf(follow), follows: [follow] });
  }
  return [...groups.values()]
    .map((group) => ({ ...group, follows: group.follows.sort(byKind) }))
    .sort((a, b) => newestOf(b.follows) - newestOf(a.follows));
}
