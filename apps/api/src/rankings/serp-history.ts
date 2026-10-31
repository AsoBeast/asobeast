import { ChartRow, MovedRow, movementOf } from '../charts/chart-movement';

export function serpMovement<T extends ChartRow>(
  current: T[],
  previous: ChartRow[] | null,
): MovedRow<T>[] {
  return movementOf(current, previous).map((row) =>
    row.movement === 'new' &&
    previous !== null &&
    row.position > previous.length
      ? { ...row, movement: 'none' }
      : row,
  );
}

export function serpExits<T extends ChartRow>(
  current: ChartRow[],
  previous: T[] | null,
): (T & { previous: number })[] {
  if (previous === null) return [];
  const listed = new Set(current.map((row) => row.storeAppId));
  return previous
    .filter(
      (row) => !listed.has(row.storeAppId) && row.position <= current.length,
    )
    .map((row) => ({ ...row, previous: row.position }))
    .sort((a, b) => a.previous - b.previous);
}
