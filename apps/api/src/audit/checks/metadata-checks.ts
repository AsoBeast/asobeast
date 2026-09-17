import { KeywordSource, Store } from '@prisma/client';
import {
  LintIssue,
  LintSeverity,
  tokenize,
  lintDescription,
  lintKeywordField,
  lintShortDescription,
  lintSubtitle,
  lintTitle,
  STORE_FIELD_LIMITS,
  utf8ByteLength,
} from '@asobeast/shared';
import { round1 } from '../audit-engine';
import {
  AuditContext,
  AuditKeyword,
  brandTier,
  charUsageScore,
  check,
  COMPETITORS_UNLOCK,
  competitorTitles,
  countPhrase,
  coversPhrase,
  KEYWORD_FIELD_UNLOCK,
  KEYWORDS_UNLOCK,
  keywordMatchScore,
  lintContext,
  lintScore,
  priorityKeywords,
  quoteList,
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

export const TITLE_LIMIT = STORE_FIELD_LIMITS.APP_STORE.title!.limit;
export const SUBTITLE_LIMIT = STORE_FIELD_LIMITS.APP_STORE.subtitle!.limit;
export const KEYWORD_FIELD_BYTE_LIMIT =
  STORE_FIELD_LIMITS.APP_STORE.keywordField!.limit;
export const KEYWORD_FIELD_FULL_BYTES = 90;
export const LOW_RELEVANCE = 40;

export const BRAND_TITLE_SCORE: Readonly<Record<string, number>> =
  Object.freeze({ dominant: 8, established: 4, challenger: 0 });

const SEVERITY_RANK: Record<LintSeverity, number> = {
  error: 0,
  warn: 1,
  info: 2,
};

const LENGTH_RULES = ['over-limit', 'under-utilized'];

const policyIssues = (issues: LintIssue[]): LintIssue[] =>
  issues
    .filter((issue) => !LENGTH_RULES.includes(issue.rule))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

const TITLE_POLICY_FIXES: Readonly<Record<string, string>> = Object.freeze({
  'policy-term':
    'Google Play does not allow performance or price claims such as \u201cbest\u201d, \u201c#1\u201d, \u201ctop\u201d or \u201cfree\u201d in titles.',
  emoji: 'Google Play does not allow emoji in the title.',
  'special-characters':
    'Symbols such as \u2122 and \u00ae spend characters Apple indexes.',
  'keyword-stuffing':
    'Repeating a word adds nothing to search and reads as stuffing.',
});

const KEYWORD_FIELD_FIXES: Readonly<Record<string, string>> = Object.freeze({
  'repeats-title-word': 'It is already indexed from your title.',
  'repeats-subtitle-word': 'It is already indexed from your subtitle.',
  'plural-form': 'Apple matches singular and plural, so the stem is enough.',
  'contains-generic-word':
    'Words like \u201capp\u201d and \u201cfree\u201d waste bytes.',
  'contains-own-brand': 'Your app and company name are already searchable.',
  'contains-competitor-brand': "Other apps' names are not allowed.",
  'short-keyword': 'Apple ignores keywords of two characters or fewer.',
  'space-after-comma': 'Spaces after commas spend bytes Apple does not index.',
});

const coveredAnywhere = (context: AuditContext, phrase: string): boolean =>
  [context.title, context.subtitle ?? '', context.summary ?? ''].some((field) =>
    coversPhrase(field, phrase),
  );

const candidateKeyword = (
  context: AuditContext,
  unused: number,
): AuditKeyword | null =>
  priorityKeywords(context.keywords).find(
    (keyword) =>
      !coveredAnywhere(context, keyword.text) &&
      keyword.text.length + 1 <= unused,
  ) ?? null;

const lengthAdvice = (
  context: AuditContext,
  field: 'title' | 'subtitle',
  chars: number,
  limit: number,
) => {
  const unused = limit - chars;
  const candidate = candidateKeyword(context, unused);
  return {
    title: `Use the ${unused} unused ${field} characters`,
    fix: candidate
      ? `Add \u201c${candidate.text}\u201d (${candidate.text.length} characters), your best uncovered keyword that still fits.`
      : `${field === 'title' ? 'Titles' : 'Subtitles'} under ${TITLE_FULL_CHARS} characters leave indexed space unused.`,
  };
};

const policyAdvice = (
  issues: LintIssue[],
  field: string,
  fixes: Readonly<Record<string, string>>,
) => {
  const first = issues[0];
  if (!first) {
    return null;
  }
  const term = first.offendingText ?? first.rule;
  const title =
    first.rule === 'keyword-stuffing'
      ? `Say \u201c${term}\u201d once in your ${field}`
      : `Remove \u201c${term}\u201d from your ${field}`;
  return { title, fix: fixes[first.rule] ?? first.message };
};

const bestTitleMatch = (
  title: string,
  primary: AuditKeyword[],
): { score: number; matched: AuditKeyword | null } => {
  let best: { score: number; matched: AuditKeyword | null } = {
    score: 0,
    matched: null,
  };
  for (const keyword of primary) {
    const score = keywordMatchScore(title, [keyword.text]);
    if (score > best.score) {
      best = { score, matched: keyword };
    }
  }
  return best;
};

export const titleChecks = (context: AuditContext): RubricCheck[] => {
  const primary = priorityKeywords(context.keywords).filter(
    (keyword) => keyword.bucket === 'primary',
  );
  const { score, matched } = bestTitleMatch(context.title, primary);
  const tier = brandTier(context.ratingCount);
  const chars = context.title.length;
  const titleLint = policyIssues(
    lintTitle(context.title, TITLE_LIMIT, context.store),
  );
  const titles = competitorTitles(context);
  const overlap = mostSimilarTitle(context.title, titles);

  return [
    check({
      id: 'title-keyword',
      label: 'Primary keyword in title',
      source: 'keywords',
      weight: 3,
      score:
        primary.length === 0
          ? null
          : score === 0
            ? BRAND_TITLE_SCORE[tier]
            : score,
      detail:
        primary.length === 0
          ? 'No primary keywords tracked to match.'
          : matched
            ? `The title contains \u201c${matched.text}\u201d, a primary keyword.`
            : `None of your primary keywords appear in the title: ${quoteList(
                primary.map((keyword) => keyword.text),
              )}.`,
      unlock: KEYWORDS_UNLOCK,
      advice: primary[0]
        ? {
            title: `Put \u201c${primary[0].text}\u201d in your title`,
            fix: `Your strongest keyword is missing from the most heavily weighted field. Rewrite the title to include \u201c${primary[0].text}\u201d within ${TITLE_LIMIT} characters, keeping your brand first if people already search for it.`,
          }
        : null,
    }),
    check({
      id: 'title-length',
      label: 'Character usage',
      source: 'store',
      weight: 2,
      score: charUsageScore(chars, TITLE_FULL_CHARS, TITLE_PARTIAL_CHARS),
      detail: `${chars} of ${TITLE_LIMIT} characters used.`,
      advice: lengthAdvice(context, 'title', chars, TITLE_LIMIT),
    }),
    check({
      id: 'title-policy',
      label: 'Store policy and formatting',
      source: 'store',
      weight: 2,
      heuristic: true,
      score: lintScore(titleLint),
      detail:
        titleLint.length === 0
          ? 'No policy or formatting issues found.'
          : `${titleLint.length} policy or formatting issues found.`,
      advice: policyAdvice(titleLint, 'title', TITLE_POLICY_FIXES),
    }),
    check({
      id: 'title-uniqueness',
      label: 'Distinct from competitors',
      source: 'competitors',
      weight: 1,
      score:
        titles.length === 0 ? null : uniquenessScore(context.title, titles),
      detail:
        overlap === null
          ? 'No competitor titles to compare against.'
          : `${overlap.percent}% of your title's words also appear in \u201c${overlap.title}\u201d.`,
      unlock: COMPETITORS_UNLOCK,
      advice: overlap
        ? {
            title: `Set your title apart from \u201c${overlap.title}\u201d`,
            fix: `${overlap.percent}% of your title's words also appear in \u201c${overlap.title}\u201d. Lead with what only you offer.`,
          }
        : null,
    }),
  ];
};

export const SUBTITLE_COVERAGE_SAMPLE = 5;

export const subtitleChecks = (context: AuditContext): RubricCheck[] => {
  const subtitle = context.subtitle ?? '';
  const empty = subtitle.trim().length === 0;
  const chars = subtitle.length;
  const outsideTitle = priorityKeywords(context.keywords)
    .filter((keyword) => !coversPhrase(context.title, keyword.text))
    .slice(0, SUBTITLE_COVERAGE_SAMPLE);
  const covered = outsideTitle.filter((keyword) =>
    coversPhrase(subtitle, keyword.text),
  );
  const missing = outsideTitle.filter(
    (keyword) => !coversPhrase(subtitle, keyword.text),
  );
  const target = missing[0]?.text ?? null;
  const repetition = lintSubtitle(subtitle, lintContext(context)).filter(
    (issue) => issue.rule === 'repeats-title-word',
  );

  const checks: RubricCheck[] = [
    check({
      id: 'subtitle-keyword',
      label: 'Priority keywords present',
      source: 'keywords',
      weight: 3,
      score:
        outsideTitle.length === 0
          ? null
          : empty
            ? 0
            : coverageScore(covered.length),
      detail:
        outsideTitle.length === 0
          ? 'No priority keywords outside the title to look for.'
          : `${covered.length} of ${outsideTitle.length} priority keywords appear in the subtitle.`,
      unlock: KEYWORDS_UNLOCK,
      advice: target
        ? {
            title: `Add \u201c${target}\u201d to your subtitle`,
            fix: `The subtitle is indexed right after the title. It covers ${
              covered.length === 0
                ? 'none'
                : quoteList(covered.map((keyword) => keyword.text))
            } of your priority keywords; add \u201c${target}\u201d.`,
          }
        : {
            title: 'Cover more priority keywords in your subtitle',
            fix: 'Only one priority keyword sits outside your title. Score more keywords so the subtitle can carry two.',
          },
    }),
    check({
      id: 'subtitle-length',
      label: 'Character usage',
      source: 'store',
      weight: 2,
      score: empty
        ? 0
        : charUsageScore(chars, TITLE_FULL_CHARS, TITLE_PARTIAL_CHARS),
      detail: `${chars} of ${SUBTITLE_LIMIT} characters used.`,
      advice: empty
        ? {
            title: 'Add a subtitle',
            fix: `The subtitle is the second indexed field on the App Store and it is empty. Pair a benefit with a secondary keyword in up to ${SUBTITLE_LIMIT} characters.`,
          }
        : lengthAdvice(context, 'subtitle', chars, SUBTITLE_LIMIT),
    }),
  ];

  if (empty) {
    return checks;
  }

  const repeated = repetition[0]?.offendingText ?? null;
  return [
    ...checks,
    check({
      id: 'subtitle-no-repetition',
      label: 'No repetition of the title',
      source: 'store',
      weight: 2,
      heuristic: true,
      score: lintScore(repetition),
      detail: `${repetition.length} words repeat the title.`,
      advice: repeated
        ? {
            title: `Replace \u201c${repeated}\u201d in your subtitle`,
            fix: `\u201c${repeated}\u201d is already in your title. Apple indexes each word once, so the subtitle should bring new words.`,
          }
        : null,
    }),
  ];
};

export const keywordFieldChecks = (context: AuditContext): RubricCheck[] => {
  const field = context.keywordField;
  if (field === null || field.trim().length === 0) {
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

  const bytes = utf8ByteLength(field);
  const hygiene = policyIssues(
    lintKeywordField(field, lintContext(context), KEYWORD_FIELD_BYTE_LIMIT),
  );
  const candidates = priorityKeywords(context.keywords).filter(
    (keyword) => !coversPhrase(field, keyword.text),
  );
  const rated = context.keywords.filter(
    (keyword) =>
      keyword.source === KeywordSource.KEYWORD_FIELD && keyword.relevance > 0,
  );
  const low = rated.filter((keyword) => keyword.relevance < LOW_RELEVANCE);

  const checks: RubricCheck[] = [
    check({
      id: 'keyword-field-bytes',
      label: 'Byte usage',
      source: 'keywords',
      weight: 2,
      score:
        bytes > KEYWORD_FIELD_BYTE_LIMIT
          ? 0
          : bytes >= KEYWORD_FIELD_FULL_BYTES
            ? 10
            : round1((bytes / KEYWORD_FIELD_FULL_BYTES) * 10),
      detail: `${bytes} of ${KEYWORD_FIELD_BYTE_LIMIT} bytes used.`,
      advice:
        bytes > KEYWORD_FIELD_BYTE_LIMIT
          ? {
              title: `Cut your keyword field to ${KEYWORD_FIELD_BYTE_LIMIT} bytes`,
              fix: `It uses ${bytes} bytes. Letters such as \u0105 or \u00fc take 2 bytes and Chinese, Japanese or Korean characters take 3, and App Store Connect refuses more than ${KEYWORD_FIELD_BYTE_LIMIT}.`,
            }
          : {
              title: `Fill the ${KEYWORD_FIELD_BYTE_LIMIT - bytes} unused keyword field bytes`,
              fix: `Add comma separated terms you track but do not cover yet${
                candidates.length === 0
                  ? ''
                  : `, such as ${quoteList(candidates.map((keyword) => keyword.text))}`
              }.`,
            },
    }),
    check({
      id: 'keyword-field-hygiene',
      label: 'Keyword field hygiene',
      source: 'keywords',
      weight: 3,
      heuristic: true,
      score: lintScore(hygiene),
      detail:
        hygiene.length === 0
          ? 'No wasted or disallowed terms found.'
          : `${hygiene.length} wasted or disallowed terms found.`,
      advice: policyAdvice(hygiene, 'keyword field', KEYWORD_FIELD_FIXES),
    }),
  ];

  if (rated.length === 0) {
    return checks;
  }

  return [
    ...checks,
    check({
      id: 'keyword-field-relevance',
      label: 'Keyword relevance',
      source: 'keywords',
      weight: 1,
      score:
        rated.reduce((sum, keyword) => sum + keyword.relevance, 0) /
        rated.length /
        10,
      detail: `Average relevance of ${rated.length} keyword field entries.`,
      advice: {
        title: 'Swap low relevance keywords out of your field',
        fix:
          low.length === 0
            ? 'Rate your keyword field entries for relevance and replace the weakest ones.'
            : `${quoteList(low.map((keyword) => keyword.text))} score under ${LOW_RELEVANCE} for relevance to your listing.`,
      },
    }),
  ];
};

const mostSimilarTitle = (
  title: string,
  competitors: string[],
): { title: string; percent: number } | null => {
  const mine = new Set(tokenize(title));
  if (competitors.length === 0 || mine.size === 0) {
    return null;
  }
  let best: { title: string; percent: number } | null = null;
  for (const competitor of competitors) {
    const theirs = new Set(tokenize(competitor));
    const shared = [...mine].filter((token) => theirs.has(token)).length;
    const percent = Math.round((shared / mine.size) * 100);
    if (!best || percent > best.percent) {
      best = { title: competitor, percent };
    }
  }
  return best;
};

export const DESCRIPTION_ABOVE_FOLD_CHARS = 167;
export const DESCRIPTION_HOOK_SENTENCE_CHARS = 25;
export const DESCRIPTION_COVERAGE_SAMPLE = 10;

export const KEYWORD_FREQUENCY_BANDS = [
  { min: 10, score: 3 },
  { min: 7, score: 7 },
  { min: 3, score: 10 },
  { min: 2, score: 7 },
  { min: 1, score: 4 },
] as const;

export const COVERAGE_SHARE_BANDS = [
  { min: 0.8, score: 10 },
  { min: 0.5, score: 7 },
  { min: 0.25, score: 4 },
] as const;

const CONVERSION_CHECKS = [
  {
    id: 'description-cta',
    label: 'Call to action',
    rule: 'no-cta',
    weight: 1,
    detail: 'Checked for a clear call to action.',
    advice: {
      title: 'End your description with a call to action',
      fix: 'Close with one line telling the reader what to do next.',
    },
  },
  {
    id: 'description-social-proof',
    label: 'Social proof',
    rule: 'no-social-proof',
    weight: 1,
    detail: 'Checked for awards, press or user counts.',
    advice: {
      title: 'Add social proof to your description',
      fix: 'Mention ratings, downloads, awards or press you can verify.',
    },
  },
  {
    id: 'description-formatting',
    label: 'Readable formatting',
    rule: 'no-formatting',
    weight: 1,
    detail: 'Checked for line breaks and bullets.',
    advice: {
      title: 'Break your description into short sections',
      fix: 'Use line breaks and bullets; walls of text are skipped.',
    },
  },
] as const;

const firstSentence = (description: string): string =>
  description.split(/[.!?\n]/)[0]?.trim() ?? '';

const frequencyScore = (count: number): number =>
  KEYWORD_FREQUENCY_BANDS.find((band) => count >= band.min)?.score ?? 0;

const coverageShareScore = (share: number): number =>
  COVERAGE_SHARE_BANDS.find((band) => share >= band.min)?.score ??
  round1((share / 0.25) * 4);

const descriptionKeywordChecks = (context: AuditContext): RubricCheck[] => {
  const priority = priorityKeywords(context.keywords);
  const sample = priority.slice(0, DESCRIPTION_COVERAGE_SAMPLE);
  const missing = sample.filter(
    (keyword) => !coversPhrase(context.description, keyword.text),
  );
  const share =
    sample.length === 0 ? 0 : (sample.length - missing.length) / sample.length;
  const top = priority.find((keyword) => keyword.bucket === 'primary') ?? null;
  const mentions = top ? countPhrase(context.description, top.text) : 0;
  const aboveFold =
    top !== null &&
    coversPhrase(
      context.description.slice(0, DESCRIPTION_ABOVE_FOLD_CHARS),
      top.text,
    );

  return [
    check({
      id: 'description-keyword-coverage',
      label: 'Priority keywords covered',
      source: 'keywords',
      weight: 3,
      score: sample.length === 0 ? null : coverageShareScore(share),
      detail:
        sample.length === 0
          ? 'No priority keywords tracked to look for.'
          : `${sample.length - missing.length} of ${sample.length} priority keywords appear in the description.`,
      unlock: KEYWORDS_UNLOCK,
      advice: missing[0]
        ? {
            title: `Cover \u201c${missing[0].text}\u201d in your full description`,
            fix: `Google Play indexes the full description. Missing: ${quoteList(
              missing.map((keyword) => keyword.text),
              5,
            )}.`,
          }
        : null,
    }),
    check({
      id: 'description-keyword-frequency',
      label: 'Top keyword frequency',
      source: 'keywords',
      weight: 2,
      score: top === null ? null : frequencyScore(mentions),
      detail:
        top === null
          ? 'No primary keyword tracked to count.'
          : `\u201c${top.text}\u201d appears ${mentions} times in the description.`,
      unlock: KEYWORDS_UNLOCK,
      advice:
        top === null
          ? null
          : mentions >= 10
            ? {
                title: `Use \u201c${top.text}\u201d less often`,
                fix: `It appears ${mentions} times; repetition beyond natural use reads as stuffing.`,
              }
            : mentions < 3
              ? {
                  title: `Mention \u201c${top.text}\u201d three to five times`,
                  fix: `It appears ${mentions} times in the full description.`,
                }
              : null,
    }),
    check({
      id: 'description-above-fold',
      label: 'Top keyword above the fold',
      source: 'keywords',
      weight: 2,
      score: top === null ? null : aboveFold ? 10 : 0,
      detail:
        top === null
          ? 'No primary keyword tracked to look for.'
          : aboveFold
            ? `\u201c${top.text}\u201d appears in the first ${DESCRIPTION_ABOVE_FOLD_CHARS} characters.`
            : `\u201c${top.text}\u201d is missing from the first ${DESCRIPTION_ABOVE_FOLD_CHARS} characters.`,
      unlock: KEYWORDS_UNLOCK,
      advice: top
        ? {
            title: `Mention \u201c${top.text}\u201d in the first ${DESCRIPTION_ABOVE_FOLD_CHARS} characters`,
            fix: 'That is the part of the description Google Play shows before it is expanded.',
          }
        : null,
    }),
  ];
};

export const descriptionChecks = (context: AuditContext): RubricCheck[] => {
  const play = context.store === Store.GOOGLE_PLAY;
  const limit = STORE_FIELD_LIMITS[context.store].description!.limit;
  const issues = lintDescription(context.description, limit);
  const empty = context.description.trim().length === 0;
  const has = (rule: string): boolean =>
    issues.some((issue) => issue.rule === rule);
  const opening = firstSentence(context.description);

  const hook = check({
    id: 'description-hook',
    label: 'Strong opening hook',
    source: 'store',
    weight: play ? 1 : 2,
    heuristic: true,
    score: empty
      ? 0
      : has('weak-hook')
        ? 3
        : opening.length < DESCRIPTION_HOOK_SENTENCE_CHARS
          ? 6
          : 10,
    detail: empty
      ? 'No description found.'
      : `The description opens with \u201c${opening}\u201d.`,
    advice: {
      title: 'Open your description with the benefit',
      fix: `It starts with \u201c${context.description.slice(0, 60)}\u201d. Only the first lines show before \u201cmore\u201d, so lead with what the user gets.`,
    },
  });

  const conversion = CONVERSION_CHECKS.map((definition) =>
    check({
      id: definition.id,
      label: definition.label,
      source: 'store',
      weight: definition.weight,
      heuristic: true,
      score: empty ? 0 : has(definition.rule) ? 4 : 10,
      detail: definition.detail,
      advice: definition.advice,
    }),
  );

  return play
    ? [hook, ...conversion, ...descriptionKeywordChecks(context)]
    : [hook, ...conversion];
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
