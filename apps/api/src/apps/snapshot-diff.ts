import { SnapshotChange } from '@asobeast/shared';

export interface DiffableSnapshot {
  title: string;
  subtitle: string | null;
  summary: string | null;
  description: string;
  ratingAvg: number | null;
  ratingCount: number | null;
  installs: bigint | null;
  version: string | null;
}

interface RecordedChange {
  field: string;
  before: string | null;
  after: string | null;
}

const TEXT_FIELDS = ['title', 'subtitle', 'summary', 'description'] as const;
const VALUE_FIELDS = ['ratingAvg', 'ratingCount', 'version'] as const;

export function diffSnapshots(
  prev: DiffableSnapshot | null,
  next: DiffableSnapshot,
): SnapshotChange[] {
  if (!prev) {
    return [];
  }

  const changes: SnapshotChange[] = [];

  for (const field of TEXT_FIELDS) {
    if (prev[field] !== next[field]) {
      changes.push({
        field,
        before: textLength(prev[field]),
        after: textLength(next[field]),
      });
    }
  }

  for (const field of VALUE_FIELDS) {
    if (prev[field] !== next[field]) {
      changes.push({ field, before: prev[field], after: next[field] });
    }
  }

  if (prev.installs !== next.installs) {
    changes.push({
      field: 'installs',
      before: bigIntToNumber(prev.installs),
      after: bigIntToNumber(next.installs),
    });
  }

  return changes;
}

export function withRecordedChanges(
  diff: readonly SnapshotChange[],
  recorded: readonly RecordedChange[],
): SnapshotChange[] {
  const reported = new Set(diff.map((change) => change.field));
  return [
    ...diff,
    ...recorded
      .filter((change) => !reported.has(change.field))
      .map(({ field, before, after }) => ({ field, before, after })),
  ];
}

function textLength(value: string | null): number | null {
  return value === null ? null : value.length;
}

function bigIntToNumber(value: bigint | null): number | null {
  return value === null ? null : Number(value);
}
