import { Store } from '@prisma/client';
import { AuditContext, check, DAY_MS, RubricCheck } from '../audit-scoring';

export const RELEASE_NOTES_MIN_CHARS = 40;

export const UPDATE_RECENCY_BANDS = [
  { maxDays: 30, score: 10 },
  { maxDays: 60, score: 8 },
  { maxDays: 90, score: 6 },
  { maxDays: 180, score: 3 },
] as const;

export const LOCALIZATION_BANDS = [
  { min: 10, score: 10 },
  { min: 5, score: 8 },
  { min: 2, score: 6 },
  { min: 1, score: 4 },
] as const;

export const GENERIC_RELEASE_NOTES =
  /^(bug fixes|bug fixes and (performance )?improvements|minor (bug fixes|improvements)|performance improvements)[.!\s]*$/i;

const recencyScore = (days: number): number =>
  UPDATE_RECENCY_BANDS.find((band) => days <= band.maxDays)?.score ?? 0;

const localizationScore = (count: number): number =>
  LOCALIZATION_BANDS.find((band) => count >= band.min)?.score ?? 0;

const genericNotes = (notes: string): boolean =>
  notes.trim().length < RELEASE_NOTES_MIN_CHARS ||
  GENERIC_RELEASE_NOTES.test(notes.trim());

const recencyCheck = (context: AuditContext): RubricCheck | null => {
  if (context.storeUpdatedAt === null) {
    return null;
  }
  const days = Math.floor(
    (context.now.getTime() - context.storeUpdatedAt.getTime()) / DAY_MS,
  );
  return check({
    id: 'conversion-update-recency',
    label: 'Update recency',
    source: 'store',
    weight: 2,
    score: recencyScore(days),
    detail: `The last update was ${days} days ago.`,
    advice: {
      title: 'Ship an update',
      fix: `The last update was ${days} days ago. Stores and shoppers read recency as maintenance.`,
    },
  });
};

const releaseNotesCheck = (context: AuditContext): RubricCheck => {
  const notes = context.rawFacts.releaseNotes;
  return check({
    id: 'conversion-release-notes',
    label: 'Release notes',
    source: 'store',
    weight: 1,
    score: notes === null ? 0 : genericNotes(notes) ? 5 : 10,
    detail:
      notes === null
        ? 'The latest version has no notes.'
        : `Release notes are ${notes.trim().length} characters long.`,
    advice: {
      title: 'Say what changed in your release notes',
      fix:
        notes === null
          ? 'The latest version has no notes.'
          : `“${notes.trim()}” tells a shopper nothing.`,
    },
  });
};

const localizationsCheck = (context: AuditContext): RubricCheck | null => {
  const languages = context.rawFacts.languages;
  if (context.store !== Store.APP_STORE || languages.length === 0) {
    return null;
  }
  return check({
    id: 'conversion-localizations',
    label: 'Localizations',
    source: 'store',
    weight: 2,
    score: localizationScore(languages.length),
    detail: `${languages.length} declared ${
      languages.length === 1 ? 'language' : 'languages'
    }.`,
    advice: {
      title: 'Localize your listing for more markets',
      fix: `${languages.length} ${
        languages.length === 1 ? 'language' : 'languages'
      }. Start with the storefronts your keywords already rank in.`,
    },
  });
};

const privacyPolicyCheck = (context: AuditContext): RubricCheck | null => {
  if (context.store !== Store.GOOGLE_PLAY) {
    return null;
  }
  const present = context.rawFacts.privacyPolicyUrl !== null;
  return check({
    id: 'conversion-privacy-policy',
    label: 'Privacy policy',
    source: 'store',
    weight: 1,
    score: present ? 10 : 0,
    detail: present
      ? 'A privacy policy is linked.'
      : 'No privacy policy linked.',
    advice: {
      title: 'Link a privacy policy',
      fix: 'Google Play shoppers look for it and some categories require it.',
    },
  });
};

export const conversionChecks = (context: AuditContext): RubricCheck[] =>
  [
    recencyCheck(context),
    releaseNotesCheck(context),
    localizationsCheck(context),
    privacyPolicyCheck(context),
  ].filter((item): item is RubricCheck => item !== null);
