import {
  KeywordBreakdownApp,
  KeywordBreakdownField,
  KeywordBreakdownInsight,
  KeywordBreakdownStanding,
  KeywordPlacement,
} from '@asobeast/shared';

export const RATINGS_GAP_FACTOR = 3;
export const SETTLING_DAYS = 28;

const PHRASE_FIELDS = [
  'title',
  'subtitle',
  'shortDescription',
  'keywordField',
] as const;

const PLACEMENT_STRENGTH: Record<KeywordPlacement, number> = {
  title: 5,
  subtitle: 4,
  shortDescription: 4,
  keywordField: 3,
  split: 2,
  partial: 1,
  none: 0,
};

interface Version {
  placement: KeywordPlacement;
  terms: ReadonlySet<string>;
  accentTerms: readonly string[];
}

function versionOf(
  fields: readonly KeywordBreakdownField[],
  total: number,
): Version {
  const terms = new Set(fields.flatMap((field) => field.terms));
  const exact = new Set(
    fields.flatMap((field) =>
      field.terms.filter((term) => !field.looseTerms.includes(term)),
    ),
  );
  const accentTerms = [...terms].filter((term) => !exact.has(term));
  const phrase = PHRASE_FIELDS.find((name) =>
    fields.some((field) => field.field === name && field.phrase),
  );
  if (phrase) {
    return { placement: phrase, terms, accentTerms };
  }
  if (terms.size === 0) {
    return { placement: 'none', terms, accentTerms };
  }
  return {
    placement: terms.size >= total ? 'split' : 'partial',
    terms,
    accentTerms,
  };
}

function bestVersion(
  app: Pick<KeywordBreakdownApp, 'fields' | 'localizations'>,
  total: number,
): Version {
  return [app.fields, ...app.localizations.map((entry) => entry.fields)]
    .map((fields) => versionOf(fields, total))
    .reduce((best, version) =>
      PLACEMENT_STRENGTH[version.placement] >
        PLACEMENT_STRENGTH[best.placement] ||
      (version.placement === best.placement &&
        version.terms.size > best.terms.size)
        ? version
        : best,
    );
}

export function placementOf(
  app: Pick<KeywordBreakdownApp, 'fields' | 'localizations'>,
  total: number,
): KeywordPlacement {
  return bestVersion(app, total).placement;
}

export function accentTermsOf(
  app: Pick<KeywordBreakdownApp, 'fields' | 'localizations'>,
  total: number,
): string[] {
  return [...bestVersion(app, total).accentTerms];
}

const ranksAbove = (
  app: KeywordBreakdownApp,
  you: KeywordBreakdownApp,
): boolean =>
  app.position !== null &&
  (you.position === null || app.position < you.position);

function insightFor(
  app: KeywordBreakdownApp,
  you: KeywordBreakdownApp,
): KeywordBreakdownInsight {
  if (PLACEMENT_STRENGTH[app.placement] > PLACEMENT_STRENGTH[you.placement]) {
    return { rule: 'placement', theirs: app.placement, yours: you.placement };
  }
  const exactOnlyTheirs = you.accentTerms.filter(
    (term) => !app.accentTerms.includes(term),
  );
  if (
    exactOnlyTheirs.length > 0 &&
    PLACEMENT_STRENGTH[app.placement] >= PLACEMENT_STRENGTH.split
  ) {
    return { rule: 'accent', terms: exactOnlyTheirs };
  }
  if (PLACEMENT_STRENGTH[app.placement] < PLACEMENT_STRENGTH.split) {
    return app.unreadLocalizations.length > 0
      ? { rule: 'unchecked', localizations: app.unreadLocalizations.length }
      : { rule: 'hidden' };
  }
  if (
    app.ratingCount !== null &&
    you.ratingCount !== null &&
    app.ratingCount >= Math.max(1, you.ratingCount) * RATINGS_GAP_FACTOR
  ) {
    return {
      rule: 'ratings',
      theirs: app.ratingCount,
      yours: you.ratingCount,
    };
  }
  return { rule: 'similar' };
}

export function withInsights(
  apps: readonly KeywordBreakdownApp[],
  terms: readonly string[],
  changedDaysAgo: number | null,
): { apps: KeywordBreakdownApp[]; standing: KeywordBreakdownStanding | null } {
  const you = apps.find((app) => app.isYou);
  if (!you) {
    return { apps: [...apps], standing: null };
  }
  const explained = apps.map((app) =>
    !app.isYou && ranksAbove(app, you)
      ? { ...app, insight: insightFor(app, you) }
      : app,
  );
  const above = explained.filter((app) => app.insight !== null);
  const covered = bestVersion(you, terms.length).terms;
  return {
    apps: explained,
    standing: {
      above: above.length,
      competitors: apps.length - 1,
      aboveWithStrongerPlacement: above.filter(
        (app) => app.insight?.rule === 'placement',
      ).length,
      missingTerms: terms.filter((term) => !covered.has(term)),
      accentTerms: [...you.accentTerms],
      changedDaysAgo:
        changedDaysAgo !== null && changedDaysAgo <= SETTLING_DAYS
          ? changedDaysAgo
          : null,
    },
  };
}
