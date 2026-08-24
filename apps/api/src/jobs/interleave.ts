export function interleave<T>(batches: T[][]): T[] {
  const longest = batches.reduce(
    (length, batch) => Math.max(length, batch.length),
    0,
  );
  const ordered: T[] = [];
  for (let index = 0; index < longest; index++) {
    for (const batch of batches) {
      if (index < batch.length) ordered.push(batch[index]);
    }
  }
  return ordered;
}

export function completionBound(
  batchSizes: number[],
  batchIndex: number,
): number {
  const own = batchSizes[batchIndex] ?? 0;
  if (own === 0) return 0;
  return batchSizes.reduce((total, size) => total + Math.min(size, own), 0);
}
