import { KeywordSource } from '@prisma/client';
import {
  lintDescription,
  lintKeywordField,
  lintShortDescription,
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
  coversPhrase,
  keywordMatchScore,
  KEYWORD_FIELD_UNLOCK,
  KEYWORDS_UNLOCK,
  lintContext,
  lintScore,
  presenceShare,
  priorityKeywords,
  RubricCheck,
  TITLE_FULL_CHARS,
  TITLE_PARTIAL_CHARS,
  uniquenessScore,
} from '../audit-scoring';

export const SHORT_DESCRIPTION_LIMIT =
  STORE_FIELD_LIMITS.GOOGLE_PLAY.shortDescription!.limit;
export const SHORT_DESCRIPTION_FULL_CHARS = 77;
export const SHORT_DESCRIPTION_PARTIAL_CHARS = 60;
export const COVERAGE_SAMPLE = 5;

const POLICY_RULES = ['policy-term', 'emoji'];

const coverageScore = (covered: number): number => {
  if (covered >= 2) return 10;
  return covered === 1 ? 6 : 0;
};

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

export const keywordFieldChecks = (context: AuditContext): RubricCheck[] => {
  const entries = context.keywords.filter(
    (keyword) => keyword.source === KeywordSource.KEYWORD_FIELD,
  );
  if (entries.length === 0) {
    return [
      check({
        id: 'keyword-field-saved',
        label: 'Keyword field',
        source: 'keywords',
        weight: 1,
        score: null,
        detail: 'No keyword field saved.',
        unlock: KEYWORD_FIELD_UNLOCK,
      }),
    ];
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

export const shortDescriptionChecks = (
  context: AuditContext,
): RubricCheck[] => {
  const summary = context.summary ?? '';
  const empty = summary.trim().length === 0;
  const priority = priorityKeywords(context.keywords).slice(0, COVERAGE_SAMPLE);
  const missing = priority.filter(
    (keyword) => !coversPhrase(summary, keyword.text),
  );
  const covered = priority.length - missing.length;
  const target = missing[0]?.text ?? priority[0]?.text ?? null;
  const issues = lintShortDescription(summary, lintContext(context));
  const repetition = issues.filter(
    (issue) => issue.rule === 'repeats-title-word',
  );
  const policy = issues.filter((issue) => POLICY_RULES.includes(issue.rule));

  const checks: RubricCheck[] = [
    check({
      id: 'short-description-keyword',
      label: 'Priority keywords present',
      source: 'keywords',
      weight: 3,
      score: priority.length === 0 ? null : empty ? 0 : coverageScore(covered),
      detail:
        priority.length === 0
          ? 'No priority keywords tracked to look for.'
          : `${covered} of ${priority.length} priority keywords appear in the short description.`,
      unlock: KEYWORDS_UNLOCK,
      advice: target
        ? {
            title: `Add “${target}” to your short description`,
            fix: `Google Play indexes the ${SHORT_DESCRIPTION_LIMIT} character short description right after the title. Work “${target}” in naturally.`,
          }
        : null,
    }),
    check({
      id: 'short-description-length',
      label: 'Character usage',
      source: 'store',
      weight: 2,
      score: charUsageScore(
        summary.length,
        SHORT_DESCRIPTION_FULL_CHARS,
        SHORT_DESCRIPTION_PARTIAL_CHARS,
      ),
      detail: `${summary.length} of ${SHORT_DESCRIPTION_LIMIT} characters used.`,
      advice: empty
        ? {
            title: 'Write a short description',
            fix: 'It is the first line shoppers read under your title and an indexed field.',
          }
        : {
            title: `Use the ${SHORT_DESCRIPTION_LIMIT - summary.length} unused short description characters`,
            fix: 'Pair a benefit with a priority keyword; Google Play indexes every character.',
          },
    }),
  ];

  if (empty) {
    return checks;
  }

  const repeated = repetition[0]?.offendingText ?? null;
  const term = policy[0]?.offendingText ?? null;
  return [
    ...checks,
    check({
      id: 'short-description-no-repetition',
      label: 'No repetition of the title',
      source: 'store',
      weight: 1,
      heuristic: true,
      score: lintScore(repetition),
      detail: `${repetition.length} words repeat the title.`,
      advice: repeated
        ? {
            title: `Replace “${repeated}” in your short description`,
            fix: `“${repeated}” is already in your title; use the space for another keyword.`,
          }
        : null,
    }),
    check({
      id: 'short-description-policy',
      label: 'Store policy',
      source: 'store',
      weight: 2,
      heuristic: true,
      score: lintScore(policy),
      detail:
        policy.length === 0
          ? 'No claims or calls to action found.'
          : `${policy.length} policy issues found.`,
      advice: term
        ? {
            title: `Remove “${term}” from your short description`,
            fix: `Google Play does not allow claims or calls to action such as “${term}” in the short description.`,
          }
        : null,
    }),
  ];
};
