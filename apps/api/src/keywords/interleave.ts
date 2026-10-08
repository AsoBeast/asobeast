import { interleave } from '../jobs/interleave';

export function interleaveDistinct<T>(
  lists: readonly (readonly T[])[],
  limit: number,
  keyOf: (item: T) => unknown = (item) => item,
): T[] {
  const seen = new Set<unknown>();
  return interleave(lists)
    .filter((item) => {
      const key = keyOf(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
