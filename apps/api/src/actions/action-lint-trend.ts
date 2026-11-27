import { Store } from '@prisma/client';
import { ActionItem, ActionTrendPoint, MetadataField } from '@asobeast/shared';
import {
  lintContextOf,
  LintSubject,
  listingFieldAudits,
  listingFieldTexts,
} from '../metadata/listing-field-audits';
import { dailyPoints, TrendWindow } from './action-trend';
import { LINT_ACTION_SEVERITY } from './rules/metadata-fix-lint';

export interface LintSnapshot {
  capturedAt: Date;
  title: string;
  subtitle: string | null;
  summary: string | null;
  description: string;
}

const LISTING_ONLY: LintSubject = {
  appName: null,
  competitorNames: [],
  trackedKeywords: [],
};

export const SNAPSHOT_LINT_FIELDS: ReadonlySet<MetadataField> = new Set([
  'title',
  'subtitle',
  'shortDescription',
  'description',
]);

export function snapshotLintField(item: ActionItem): MetadataField | null {
  if (item.evidence?.rule !== 'metadata.fix_lint') return null;
  const { field } = item.evidence;
  return SNAPSHOT_LINT_FIELDS.has(field) ? field : null;
}

export function lintErrorCount(
  store: Store,
  field: MetadataField,
  snapshot: LintSnapshot,
): number | null {
  const texts = listingFieldTexts(snapshot, '');
  const audit = listingFieldAudits(
    store,
    texts,
    lintContextOf(texts, LISTING_ONLY),
  ).find((candidate) => candidate.field === field);
  return audit
    ? audit.issues.filter((issue) => issue.severity === LINT_ACTION_SEVERITY)
        .length
    : null;
}

export function lintErrorPoints(
  store: Store,
  field: MetadataField,
  snapshots: readonly LintSnapshot[],
  { from, to }: TrendWindow,
): ActionTrendPoint[] {
  return dailyPoints(
    snapshots.flatMap((snapshot) => {
      const value = lintErrorCount(store, field, snapshot);
      return value === null ? [] : [{ date: snapshot.capturedAt, value }];
    }),
    from,
    to,
  );
}
