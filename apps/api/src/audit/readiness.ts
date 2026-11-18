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
import { AuditCheckId, AuditExtract } from './audit-scoring';
import { PageAppEvent } from '../store-providers/app-store-page';

const EVENTS_LINK: ReadinessLink = {
  href: 'https://developer.apple.com/app-store/in-app-events/',
  label: 'About in-app events',
};

const ACCESSIBILITY_ROW: ReadinessItem = {
  id: 'accessibility',
  label: 'Accessibility',
  status: 'unmeasurable',
  detail: 'Declared accessibility features are not read yet.',
  link: null,
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

const listedEvents = (extract: AuditExtract): PageAppEvent[] =>
  extract.fallback
    ? extract.facts.appEvents.filter(
        (event) =>
          event.endsAt === null ||
          new Date(event.endsAt).getTime() >= Date.now(),
      )
    : extract.facts.appEvents;

const eventsRow = (extract: AuditExtract | null): ReadinessItem => {
  if (extract === null) {
    return unmeasurable('in-app-events', 'In-app events');
  }
  const count = listedEvents(extract).length;
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

const accessibilityRow = (): ReadinessItem => ACCESSIBILITY_ROW;

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
}

export const buildReadiness = ({
  store,
  factors,
  extract,
}: ReadinessInputs): AppReadiness | null => {
  if (store !== Store.APP_STORE) {
    return null;
  }
  return {
    items: [
      reusedRow(PREVIEW_VIDEO_ROW, factors),
      eventsRow(extract),
      accessibilityRow(),
      ...REUSED_ROWS.map((row) => reusedRow(row, factors)),
    ],
    editorial: editorialOf(extract),
    extractAsOf: extract?.asOf ?? null,
  };
};
