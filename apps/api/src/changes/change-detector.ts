import { ChangeDetail, ChangeField } from '@asobeast/shared';
import {
  describeImagesChange,
  diffScreenshotImages,
  KeyedScreenshot,
  screenshotImagesDetail,
} from './screenshot-diff';

export interface DiffableChangeSnapshot {
  title: string;
  subtitle: string | null;
  summary: string | null;
  description: string;
  version: string | null;
  price: number | null;
  screenshotsCount: number | null;
  screenshots?: KeyedScreenshot[] | null;
  iconUrl: string | null;
  releaseNotes: string | null;
}

export interface DetectedChange {
  field: ChangeField;
  before: string | null;
  after: string | null;
  detail?: ChangeDetail;
}

type Strategy = 'text' | 'length' | 'number' | 'truncate';

const TRUNCATE_LIMIT = 300;

interface FieldSpec {
  field: ChangeField;
  key: Exclude<keyof DiffableChangeSnapshot, 'screenshots'>;
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
  return withImageChanges(prev, next, changes);
}

function withImageChanges(
  prev: DiffableChangeSnapshot,
  next: DiffableChangeSnapshot,
  changes: DetectedChange[],
): DetectedChange[] {
  if (!prev.screenshots || !next.screenshots) {
    return changes;
  }
  const diff = diffScreenshotImages(prev.screenshots, next.screenshots);
  if (diff === null) {
    return changes;
  }
  const detail = screenshotImagesDetail(
    prev.screenshots,
    next.screenshots,
    diff,
  );
  const count = changes.find((change) => change.field === 'screenshots');
  if (count) {
    count.detail = detail;
    return changes;
  }
  return [
    ...changes,
    {
      field: 'screenshotImages',
      ...describeImagesChange(
        prev.screenshots.length,
        next.screenshots.length,
        diff,
      ),
      detail,
    },
  ];
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
