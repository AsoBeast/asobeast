import { Store } from '@prisma/client';
import {
  AppReadiness,
  AuditCheckResult,
  AuditFactorResult,
  ReadinessEditorial,
  ReadinessItem,
  ReadinessLink,
  ReadinessStatus,
} from '@asobeast/shared';
import {
  AuditCheckId,
  AuditExtract,
  DAY_MS,
  FeaturingReads,
} from './audit-scoring';
import { PageAppEvent } from '../store-providers/app-store-page';

const EVENTS_LINK: ReadinessLink = {
  href: 'https://developer.apple.com/app-store/in-app-events/',
  label: 'About in-app events',
};

const FACTOR_SECTION_LINK: ReadinessLink = {
  href: '#factors-conversion',
  label: 'Where the audit scores it',
};

interface ReuseRow {
  id: ReadinessItem['id'];
  label: string;
  checkId: AuditCheckId;
}

const PREVIEW_VIDEO_ROW: ReuseRow = {
  id: 'preview-video',
  label: 'Preview video',
  checkId: 'preview-video-present',
};

const REUSED_ROWS = [
  { id: 'rating', label: 'Average rating', checkId: 'ratings-average' },
  {
    id: 'update-recency',
    label: 'Update recency',
    checkId: 'conversion-update-recency',
  },
  {
    id: 'localizations',
    label: 'Localizations',
    checkId: 'conversion-localizations',
  },
  { id: 'screenshots', label: 'Screenshots', checkId: 'screenshots-count' },
] as const satisfies readonly ReuseRow[];

const findCheck = (
  factors: AuditFactorResult[],
  checkId: AuditCheckId,
): AuditCheckResult | null => {
  for (const factor of factors) {
    const found = factor.checks.find((item) => item.id === checkId);
    if (found) {
      return found;
    }
  }
  return null;
};

const reusedRow = (
  row: ReuseRow,
  factors: AuditFactorResult[],
): ReadinessItem => {
  const found = findCheck(factors, row.checkId);
  const status: ReadinessStatus =
    found === null || found.status === 'unanswered'
      ? 'unmeasurable'
      : found.status;
  return {
    id: row.id,
    label: row.label,
    status,
    detail: found?.detail ?? null,
    link: FACTOR_SECTION_LINK,
  };
};

const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const unmeasurable = (
  id: ReadinessItem['id'],
  label: string,
): ReadinessItem => ({
  id,
  label,
  status: 'unmeasurable',
  detail: null,
  link: null,
});

const notMeasuredWith = (
  id: ReadinessItem['id'],
  label: string,
  detail: string | null,
): ReadinessItem => ({
  id,
  label,
  status: 'unmeasurable',
  detail,
  link: null,
});

const listedEvents = (extract: AuditExtract, now: Date): PageAppEvent[] =>
  extract.facts.appEvents.filter(
    (event) =>
      event.endsAt === null ||
      new Date(event.endsAt).getTime() >= now.getTime(),
  );

const eventsRow = (extract: AuditExtract | null, now: Date): ReadinessItem => {
  if (extract === null) {
    return unmeasurable('in-app-events', 'In-app events');
  }
  const count = listedEvents(extract, now).length;
  return {
    id: 'in-app-events',
    label: 'In-app events',
    status: count > 0 ? 'pass' : 'fail',
    detail:
      count > 0
        ? `The store page lists ${plural(count, 'in-app event')}.`
        : 'No in-app event is on the store page.',
    link: EVENTS_LINK,
  };
};

const NOMINATIONS_LABEL = 'Nominations';
const PROMO_TEXT_LABEL = 'Promotional text';

const shippedRecently = (factors: AuditFactorResult[]): boolean =>
  findCheck(factors, 'conversion-update-recency')?.status === 'pass';

const leadTimeOf = (reads: FeaturingReads): number | null => {
  if (reads.submittedDate === null || reads.publishStartDate === null) {
    return null;
  }
  const days = Math.ceil(
    (reads.publishStartDate.getTime() - reads.submittedDate.getTime()) / DAY_MS,
  );
  return days >= 1 ? days : null;
};

const nominationsRow = (
  reads: FeaturingReads | null,
  factors: AuditFactorResult[],
): ReadinessItem => {
  if (reads === null) {
    return unmeasurable('nominations', NOMINATIONS_LABEL);
  }
  if (reads.roleRefused || reads.nominationsError !== null) {
    return notMeasuredWith(
      'nominations',
      NOMINATIONS_LABEL,
      reads.nominationsError,
    );
  }
  const leadTime = leadTimeOf(reads);
  if (reads.submittedNominations > 0) {
    return {
      id: 'nominations',
      label: NOMINATIONS_LABEL,
      status: 'pass',
      detail:
        leadTime === null
          ? 'A nomination is submitted for featuring.'
          : `Submitted ${plural(leadTime, 'day')} before the publish window.`,
      link: null,
    };
  }
  const missed = shippedRecently(factors)
    ? ' The window for the current version was missed until the next release.'
    : '';
  const detail =
    reads.draftNominations > 0
      ? `A nomination is still a draft. Apple asks for nominations at least two weeks ahead.${missed}`
      : `Not nominated. Apple asks for nominations at least two weeks ahead.${missed}`;
  return {
    id: 'nominations',
    label: NOMINATIONS_LABEL,
    status: 'warn',
    detail,
    link: null,
  };
};

const promotionalTextRow = (reads: FeaturingReads | null): ReadinessItem => {
  if (reads === null) {
    return unmeasurable('promotional-text', PROMO_TEXT_LABEL);
  }
  if (reads.promoError !== null || reads.promoTotal === 0) {
    return notMeasuredWith(
      'promotional-text',
      PROMO_TEXT_LABEL,
      reads.promoError,
    );
  }
  const filled = reads.promoFilled;
  const total = reads.promoTotal;
  return {
    id: 'promotional-text',
    label: PROMO_TEXT_LABEL,
    status: filled === total ? 'pass' : 'warn',
    detail:
      filled === total
        ? `Promotional text is set for all ${total} localizations.`
        : `Promotional text is set for ${filled} of ${total} localizations.`,
    link: null,
  };
};

const editorialOf = (
  extract: AuditExtract | null,
): ReadinessEditorial | null =>
  extract === null
    ? null
    : {
        stories: extract.facts.featuredStories.length,
        editorsChoiceBadge: extract.facts.editorsChoice?.showsBadge === true,
      };

export interface ReadinessInputs {
  store: Store;
  factors: AuditFactorResult[];
  extract: AuditExtract | null;
  featuring: FeaturingReads | null;
  now: Date;
}

export const buildReadiness = ({
  store,
  factors,
  extract,
  featuring,
  now,
}: ReadinessInputs): AppReadiness | null => {
  if (store !== Store.APP_STORE) {
    return null;
  }
  return {
    items: [
      reusedRow(PREVIEW_VIDEO_ROW, factors),
      eventsRow(extract, now),
      nominationsRow(featuring, factors),
      promotionalTextRow(featuring),
      ...REUSED_ROWS.map((row) => reusedRow(row, factors)),
    ],
    editorial: editorialOf(extract),
    extractAsOf: extract?.asOf ?? null,
  };
};
