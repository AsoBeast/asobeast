import { ChangeField } from '@asobeast/shared';

export interface DiffableChangeSnapshot {
  title: string;
  subtitle: string | null;
  summary: string | null;
  description: string;
  version: string | null;
  price: number | null;
  screenshotsCount: number | null;
  iconUrl: string | null;
  releaseNotes: string | null;
}

export interface DetectedChange {
  field: ChangeField;
  before: string | null;
  after: string | null;
}

type Strategy = 'text' | 'length' | 'number' | 'truncate';

const TRUNCATE_LIMIT = 300;

interface FieldSpec {
  field: ChangeField;
  key: keyof DiffableChangeSnapshot;
  strategy: Strategy;
}

const FIELD_SPECS: FieldSpec[] = [
  { field: 'title', key: 'title', strategy: 'text' },
  { field: 'subtitle', key: 'subtitle', strategy: 'text' },
  { field: 'summary', key: 'summary', strategy: 'length' },
  { field: 'description', key: 'description', strategy: 'length' },
  { field: 'version', key: 'version', strategy: 'text' },
  { field: 'price', key: 'price', strategy: 'number' },
  { field: 'screenshots', key: 'screenshotsCount', strategy: 'number' },
  { field: 'icon', key: 'iconUrl', strategy: 'text' },
  { field: 'whatsNew', key: 'releaseNotes', strategy: 'truncate' },
];

export function detectChanges(
  prev: DiffableChangeSnapshot | null,
  next: DiffableChangeSnapshot,
): DetectedChange[] {
  if (!prev) {
    return [];
  }

  const changes: DetectedChange[] = [];
  for (const spec of FIELD_SPECS) {
    const before = prev[spec.key];
    const after = next[spec.key];
    if (before === after) {
      continue;
    }
    changes.push({
      field: spec.field,
      before: render(spec.strategy, before),
      after: render(spec.strategy, after),
    });
  }
  return changes;
}

function render(
  strategy: Strategy,
  value: string | number | null,
): string | null {
  if (value === null) {
    return null;
  }
  if (strategy === 'length') {
    return String(String(value).length);
  }
  if (strategy === 'truncate') {
    const text = String(value);
    return text.length > TRUNCATE_LIMIT
      ? `${text.slice(0, TRUNCATE_LIMIT)}…`
      : text;
  }
  return String(value);
}
