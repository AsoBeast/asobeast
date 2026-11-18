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

const PRODUCT_PAGE_LINK: ReadinessLink = {
  href: 'https://developer.apple.com/app-store/product-page/',
  label: 'About the product page',
};

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
] as const satisfies readonly {
  id: ReadinessItem['id'];
  label: string;
  checkId: AuditCheckId;
}[];

type ReuseRow = (typeof REUSED_ROWS)[number];

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

const previewVideoRow = (extract: AuditExtract | null): ReadinessItem => {
  if (extract === null || extract.facts.previewVideoUrls === null) {
    return unmeasurable('preview-video', 'Preview video');
  }
  const { previewVideoUrls: videos } = extract.facts;
  return {
    id: 'preview-video',
    label: 'Preview video',
    status: videos.length > 0 ? 'pass' : 'fail',
    detail:
      videos.length > 0
        ? `The store page shows ${plural(videos.length, 'preview video')}.`
        : 'No preview video is on the store page.',
    link: PRODUCT_PAGE_LINK,
  };
};

const eventsRow = (extract: AuditExtract | null): ReadinessItem => {
  if (extract === null) {
    return unmeasurable('in-app-events', 'In-app events');
  }
  const count = extract.facts.appEvents.length;
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
      previewVideoRow(extract),
      eventsRow(extract),
      accessibilityRow(),
      ...REUSED_ROWS.map((row) => reusedRow(row, factors)),
    ],
    editorial: editorialOf(extract),
    extractAsOf: extract?.asOf ?? null,
  };
};
