export function serpVolatility(dailySets: string[][]): number | null {
  const sets = dailySets
    .map((ids) => new Set(ids))
    .filter((set) => set.size > 0);
  if (sets.length < 2) {
    return null;
  }
  let total = 0;
  for (let i = 1; i < sets.length; i += 1) {
    total += jaccardDistance(sets[i - 1], sets[i]);
  }
  return Math.round((total / (sets.length - 1)) * 100);
}

function jaccardDistance(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const id of a) {
    if (b.has(id)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : 1 - intersection / union;
}
