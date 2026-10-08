export function interleave<T>(
  lists: readonly (readonly T[])[],
  limit: number,
  keyOf: (item: T) => unknown = (item) => item,
): T[] {
  const taken: T[] = [];
  const seen = new Set<unknown>();
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest && taken.length < limit; index++) {
    for (const list of lists) {
      if (index >= list.length) continue;
      const item = list[index];
      const key = keyOf(item);
      if (seen.has(key)) continue;
      seen.add(key);
      taken.push(item);
      if (taken.length === limit) break;
    }
  }
  return taken;
}
