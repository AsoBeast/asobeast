export function stepDate(
  dates: readonly string[],
  current: string,
  direction: -1 | 1,
): string | null {
  const sorted = [...dates].sort();
  const found =
    direction === 1
      ? sorted.find((date) => date > current)
      : sorted.findLast((date) => date < current);
  return found ?? null;
}
