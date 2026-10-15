import { ChartMover, ChartMovement, ChartTrending } from '@asobeast/shared';

export interface ChartRow {
  position: number;
  storeAppId: string;
}

export type ChartListing = ChartRow &
  Pick<ChartMover, 'title' | 'developer' | 'iconUrl'>;

export type MovedRow<T extends ChartRow> = T & {
  previous: number | null;
  delta: number | null;
  movement: ChartMovement;
};

function positionsOf(rows: ChartRow[]): Map<string, number> {
  const positions = new Map<string, number>();
  for (const row of rows) {
    if (!positions.has(row.storeAppId)) {
      positions.set(row.storeAppId, row.position);
    }
  }
  return positions;
}

function movementKind(delta: number | null): ChartMovement {
  if (delta === null) return 'new';
  if (delta < 0) return 'up';
  return delta > 0 ? 'down' : 'same';
}

export function movementOf<T extends ChartRow>(
  current: T[],
  previous: ChartRow[] | null,
): MovedRow<T>[] {
  if (previous === null) {
    return current.map((row) => ({
      ...row,
      previous: null,
      delta: null,
      movement: 'none',
    }));
  }
  const before = positionsOf(previous);
  return current.map((row) => {
    const prior = before.get(row.storeAppId) ?? null;
    const delta = prior === null ? null : row.position - prior;
    return { ...row, previous: prior, delta, movement: movementKind(delta) };
  });
}

function moverOf(
  row: ChartListing,
  place: Pick<ChartMover, 'position' | 'previous' | 'delta'>,
): ChartMover {
  return {
    storeAppId: row.storeAppId,
    title: row.title,
    developer: row.developer,
    iconUrl: row.iconUrl,
    ...place,
  };
}

const toMover = (row: MovedRow<ChartListing>): ChartMover =>
  moverOf(row, {
    position: row.position,
    previous: row.previous,
    delta: row.delta,
  });

const byPosition = (a: ChartRow, b: ChartRow) => a.position - b.position;

function withMovement(
  rows: MovedRow<ChartListing>[],
  movement: ChartMovement,
): MovedRow<ChartListing>[] {
  return rows.filter((row) => row.movement === movement);
}

export function trendingOf(
  current: ChartListing[],
  previous: ChartListing[] | null,
  limit: number,
): ChartTrending {
  if (previous === null) {
    return { climbers: [], fallers: [], entries: [], exits: [] };
  }
  const moved = movementOf(current, previous);
  const present = new Set(current.map((row) => row.storeAppId));
  const climbers = withMovement(moved, 'up').sort(
    (a, b) => (a.delta ?? 0) - (b.delta ?? 0) || byPosition(a, b),
  );
  const fallers = withMovement(moved, 'down').sort(
    (a, b) => (b.delta ?? 0) - (a.delta ?? 0) || byPosition(a, b),
  );
  const entries = withMovement(moved, 'new').sort(byPosition);
  const exits = previous
    .filter((row) => !present.has(row.storeAppId))
    .sort(byPosition)
    .map((row) =>
      moverOf(row, { position: null, previous: row.position, delta: null }),
    );
  return {
    climbers: climbers.slice(0, limit).map(toMover),
    fallers: fallers.slice(0, limit).map(toMover),
    entries: entries.slice(0, limit).map(toMover),
    exits: exits.slice(0, limit),
  };
}
