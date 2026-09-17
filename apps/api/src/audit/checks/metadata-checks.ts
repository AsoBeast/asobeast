import { KeywordSource } from '@prisma/client';
import {
  AuditCheckResult,
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
  TITLE_FULL_CHARS,
  TITLE_PARTIAL_CHARS,
  uniquenessScore,
} from '../audit-scoring';

export const titleChecks = (context: AuditContext): AuditCheckResult[] => {
  const primary = bucketTexts(context.keywords, 'primary');
  return [
    check(
      'title-keyword',
      'Primary keyword in title',
      'auto',
      keywordMatchScore(context.title, primary),
      primary.length === 0
        ? 'No primary keywords tracked to match.'
        : 'Matched primary keywords against the title.',
    ),
    check(
      'title-char-usage',
      'Character usage',
      'auto',
      charUsageScore(
        context.title.length,
        TITLE_FULL_CHARS,
        TITLE_PARTIAL_CHARS,
      ),
      `${context.title.length} of 30 characters used.`,
    ),
    check(
      'title-lint',
      'Readability and formatting',
      'heuristic',
      lintScore(lintTitle(context.title)),
      'Checked for stuffing and special characters.',
    ),
    check(
      'title-uniqueness',
      'Distinct from competitors',
      'auto',
      uniquenessScore(context.title, context.competitorTitles),
      'Compared title tokens against competitor titles.',
    ),
  ];
};

export const subtitleChecks = (context: AuditContext): AuditCheckResult[] => {
  const subtitle = context.subtitle ?? '';
  const secondary = bucketTexts(context.keywords, 'secondary');
  return [
    check(
      'subtitle-keyword',
      'Secondary keywords present',
      'auto',
      presenceShare(subtitle, secondary),
      'Checked subtitle for secondary keywords.',
    ),
    check(
      'subtitle-no-repetition',
      'No repetition of the title',
      'heuristic',
      lintScore(lintSubtitle(subtitle, lintContext(context))),
      'Checked subtitle for repeated title words.',
    ),
    check(
      'subtitle-char-usage',
      'Character usage',
      'auto',
      charUsageScore(subtitle.length, TITLE_FULL_CHARS, TITLE_PARTIAL_CHARS),
      `${subtitle.length} of 30 characters used.`,
    ),
  ];
};

export const keywordFieldChecks = (
  context: AuditContext,
): AuditCheckResult[] | null => {
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
    check(
      'keyword-field-lint',
      'Keyword field hygiene',
      'heuristic',
      lintScore(lintKeywordField(value, lintContext(context), limit)),
      'Checked for repetition, spaces and generic words.',
    ),
    check(
      'keyword-field-char-usage',
      'Character usage',
      'auto',
      clamp((value.length / limit) * 10, 0, 10),
      `${value.length} of ${limit} characters used.`,
    ),
    check(
      'keyword-field-relevance',
      'Keyword relevance',
      'auto',
      clamp(relevanceAvg / 10, 0, 10),
      'Average relevance of keyword field entries.',
    ),
  ];
};

export const descriptionChecks = (
  context: AuditContext,
): AuditCheckResult[] => {
  const limit = STORE_FIELD_LIMITS.APP_STORE.description!.limit;
  const issues = lintDescription(context.description, limit);
  const empty = context.description.trim().length === 0;
  const has = (rule: string): boolean =>
    issues.some((issue) => issue.rule === rule);
  const binary = (present: boolean): number => (empty || present ? 0 : 10);
  return [
    check(
      'description-hook',
      'Strong opening hook',
      'heuristic',
      binary(has('weak-hook')),
      'Checked the first lines for a weak hook.',
    ),
    check(
      'description-cta',
      'Call to action',
      'heuristic',
      binary(has('no-cta')),
      'Checked for a clear call to action.',
    ),
    check(
      'description-social-proof',
      'Social proof',
      'heuristic',
      binary(has('no-social-proof')),
      'Checked for awards, press or user counts.',
    ),
    check(
      'description-formatting',
      'Readable formatting',
      'heuristic',
      binary(has('no-formatting')),
      'Checked for line breaks and bullets.',
    ),
  ];
};
