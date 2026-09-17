import { KeywordSource } from '@prisma/client';
import {
  lintDescription,
  lintKeywordField,
  lintSubtitle,
  lintTitle,
  STORE_FIELD_LIMITS,
} from '@asobeast/shared';
import { clamp } from '../../scoring/formulas';
import {
  AuditContext,
  bucketTexts,
  charUsageScore,
  check,
  keywordMatchScore,
  lintContext,
  lintScore,
  presenceShare,
  RubricCheck,
  TITLE_FULL_CHARS,
  TITLE_PARTIAL_CHARS,
  uniquenessScore,
} from '../audit-scoring';

export const titleChecks = (context: AuditContext): RubricCheck[] => {
  const primary = bucketTexts(context.keywords, 'primary');
  return [
    check({
      id: 'title-keyword',
      label: 'Primary keyword in title',
      source: 'keywords',
      weight: 3,
      score: keywordMatchScore(context.title, primary),
      detail:
        primary.length === 0
          ? 'No primary keywords tracked to match.'
          : 'Matched primary keywords against the title.',
    }),
    check({
      id: 'title-char-usage',
      label: 'Character usage',
      source: 'store',
      weight: 2,
      score: charUsageScore(
        context.title.length,
        TITLE_FULL_CHARS,
        TITLE_PARTIAL_CHARS,
      ),
      detail: `${context.title.length} of 30 characters used.`,
    }),
    check({
      id: 'title-lint',
      label: 'Readability and formatting',
      source: 'store',
      weight: 2,
      heuristic: true,
      score: lintScore(lintTitle(context.title)),
      detail: 'Checked for stuffing and special characters.',
    }),
    check({
      id: 'title-uniqueness',
      label: 'Distinct from competitors',
      source: 'competitors',
      weight: 1,
      score: uniquenessScore(context.title, context.competitorTitles),
      detail: 'Compared title tokens against competitor titles.',
    }),
  ];
};

export const subtitleChecks = (context: AuditContext): RubricCheck[] => {
  const subtitle = context.subtitle ?? '';
  const secondary = bucketTexts(context.keywords, 'secondary');
  return [
    check({
      id: 'subtitle-keyword',
      label: 'Secondary keywords present',
      source: 'keywords',
      weight: 3,
      score: presenceShare(subtitle, secondary),
      detail: 'Checked subtitle for secondary keywords.',
    }),
    check({
      id: 'subtitle-no-repetition',
      label: 'No repetition of the title',
      source: 'store',
      weight: 2,
      heuristic: true,
      score: lintScore(lintSubtitle(subtitle, lintContext(context))),
      detail: 'Checked subtitle for repeated title words.',
    }),
    check({
      id: 'subtitle-char-usage',
      label: 'Character usage',
      source: 'store',
      weight: 2,
      score: charUsageScore(
        subtitle.length,
        TITLE_FULL_CHARS,
        TITLE_PARTIAL_CHARS,
      ),
      detail: `${subtitle.length} of 30 characters used.`,
    }),
  ];
};

export const keywordFieldChecks = (
  context: AuditContext,
): RubricCheck[] | null => {
  const entries = context.keywords.filter(
    (keyword) => keyword.source === KeywordSource.KEYWORD_FIELD,
  );
  if (entries.length === 0) {
    return null;
  }
  const value = entries.map((entry) => entry.text).join(',');
  const limit = STORE_FIELD_LIMITS.APP_STORE.keywordField!.limit;
  const relevanceAvg =
    entries.reduce((sum, entry) => sum + entry.relevance, 0) / entries.length;
  return [
    check({
      id: 'keyword-field-lint',
      label: 'Keyword field hygiene',
      source: 'keywords',
      weight: 3,
      heuristic: true,
      score: lintScore(lintKeywordField(value, lintContext(context), limit)),
      detail: 'Checked for repetition, spaces and generic words.',
    }),
    check({
      id: 'keyword-field-char-usage',
      label: 'Character usage',
      source: 'keywords',
      weight: 2,
      score: clamp((value.length / limit) * 10, 0, 10),
      detail: `${value.length} of ${limit} characters used.`,
    }),
    check({
      id: 'keyword-field-relevance',
      label: 'Keyword relevance',
      source: 'keywords',
      weight: 1,
      score: clamp(relevanceAvg / 10, 0, 10),
      detail: 'Average relevance of keyword field entries.',
    }),
  ];
};

const DESCRIPTION_CHECKS = [
  {
    id: 'description-hook',
    label: 'Strong opening hook',
    rule: 'weak-hook',
    weight: 2,
    detail: 'Checked the first lines for a weak hook.',
  },
  {
    id: 'description-cta',
    label: 'Call to action',
    rule: 'no-cta',
    weight: 1,
    detail: 'Checked for a clear call to action.',
  },
  {
    id: 'description-social-proof',
    label: 'Social proof',
    rule: 'no-social-proof',
    weight: 1,
    detail: 'Checked for awards, press or user counts.',
  },
  {
    id: 'description-formatting',
    label: 'Readable formatting',
    rule: 'no-formatting',
    weight: 1,
    detail: 'Checked for line breaks and bullets.',
  },
] as const;

export const descriptionChecks = (context: AuditContext): RubricCheck[] => {
  const limit = STORE_FIELD_LIMITS.APP_STORE.description!.limit;
  const issues = lintDescription(context.description, limit);
  const empty = context.description.trim().length === 0;
  const has = (rule: string): boolean =>
    issues.some((issue) => issue.rule === rule);
  return DESCRIPTION_CHECKS.map((definition) =>
    check({
      id: definition.id,
      label: definition.label,
      source: 'store',
      weight: definition.weight,
      heuristic: true,
      score: empty || has(definition.rule) ? 0 : 10,
      detail: definition.detail,
    }),
  );
};
