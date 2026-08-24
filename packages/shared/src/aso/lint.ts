import { isStopword, normalizeText, tokenize } from '../text';
import { countChars } from './limits';

export type LintSeverity = 'error' | 'warn' | 'info';

export interface LintIssue {
  rule: string;
  severity: LintSeverity;
  message: string;
  offendingText?: string;
}

export interface LintContext {
  titleWords?: string[];
  subtitleWords?: string[];
  brandTokens?: string[];
  competitorNames?: string[];
  trackedKeywords?: string[];
}

const UNDER_UTILIZED_RATIO = 0.7;
const GENERIC_WORDS: ReadonlySet<string> = new Set(['app', 'apps', 'free']);
const SPECIAL_CHARS = /[™®]/;
const WEAK_HOOK = /^\s*welcome to\b/i;
const CTA_PATTERN =
  /\b(download|try|get started|sign up|start now|start today|start free|join|subscribe|install|upgrade|get the app)\b/i;
const SOCIAL_PROOF_PATTERN =
  /(\b(million|users|downloads|awarded?|featured|rated|press|trusted|loved by|reviews?)\b|#1|number one|\d[\d,.]*\+)/i;

const contentTokens = (text: string): string[] =>
  tokenize(text).filter((token) => !isStopword(token));

const toSet = (words: readonly string[] | undefined): ReadonlySet<string> =>
  new Set((words ?? []).flatMap((word) => tokenize(word)));

const overLimit = (text: string, limit: number): LintIssue[] => {
  const chars = countChars(text);
  if (chars <= limit) {
    return [];
  }
  return [
    {
      rule: 'over-limit',
      severity: 'error',
      message: `Exceeds the ${limit} character limit (${chars}).`,
    },
  ];
};

const underUtilized = (text: string, limit: number): LintIssue[] => {
  const chars = countChars(text.trim());
  if (chars === 0 || chars >= limit * UNDER_UTILIZED_RATIO) {
    return [];
  }
  return [
    {
      rule: 'under-utilized',
      severity: 'warn',
      message: `Only ${chars} of ${limit} characters used.`,
    },
  ];
};

const keywordStuffing = (text: string): LintIssue[] => {
  const counts = new Map<string, number>();
  for (const token of contentTokens(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const issues: LintIssue[] = [];
  for (const [token, count] of counts) {
    if (count > 1) {
      issues.push({
        rule: 'keyword-stuffing',
        severity: 'warn',
        message: `"${token}" is repeated ${count} times.`,
        offendingText: token,
      });
    }
  }
  return issues;
};

const repeats = (
  text: string,
  against: ReadonlySet<string>,
  rule: string,
  label: string,
): LintIssue[] => {
  const seen = new Set<string>();
  const issues: LintIssue[] = [];
  for (const token of contentTokens(text)) {
    if (against.has(token) && !seen.has(token)) {
      seen.add(token);
      issues.push({
        rule,
        severity: 'error',
        message: `"${token}" already appears in the ${label}.`,
        offendingText: token,
      });
    }
  }
  return issues;
};

export function lintTitle(title: string, limit = 30): LintIssue[] {
  const issues: LintIssue[] = [
    ...overLimit(title, limit),
    ...underUtilized(title, limit),
    ...keywordStuffing(title),
  ];
  const special = title.match(SPECIAL_CHARS);
  if (special) {
    issues.push({
      rule: 'special-characters',
      severity: 'warn',
      message: 'Special characters (™, ®) waste indexed characters.',
      offendingText: special[0],
    });
  }
  return issues;
}

export function lintSubtitle(
  subtitle: string,
  context: LintContext = {},
  limit = 30,
): LintIssue[] {
  return [
    ...overLimit(subtitle, limit),
    ...underUtilized(subtitle, limit),
    ...repeats(
      subtitle,
      toSet(context.titleWords),
      'repeats-title-word',
      'title',
    ),
    ...keywordStuffing(subtitle),
  ];
}

export function lintShortDescription(
  text: string,
  context: LintContext = {},
  limit = 80,
): LintIssue[] {
  const issues: LintIssue[] = [
    ...overLimit(text, limit),
    ...underUtilized(text, limit),
    ...repeats(text, toSet(context.titleWords), 'repeats-title-word', 'title'),
    ...keywordStuffing(text),
  ];

  const tracked = context.trackedKeywords ?? [];
  if (text.trim().length > 0 && tracked.length > 0) {
    const haystack = ` ${normalizeText(text)} `;
    const covers = tracked.some((keyword) => {
      const normalized = normalizeText(keyword);
      return normalized.length > 0 && haystack.includes(` ${normalized} `);
    });
    if (!covers) {
      issues.push({
        rule: 'no-tracked-keyword',
        severity: 'warn',
        message: 'No tracked keyword appears in the short description.',
      });
    }
  }

  return issues;
}

export function lintKeywordField(
  field: string,
  context: LintContext = {},
  limit = 100,
): LintIssue[] {
  const issues: LintIssue[] = [
    ...overLimit(field, limit),
    ...underUtilized(field, limit),
    ...repeats(field, toSet(context.titleWords), 'repeats-title-word', 'title'),
    ...repeats(
      field,
      toSet(context.subtitleWords),
      'repeats-subtitle-word',
      'subtitle',
    ),
  ];

  const spaceMatch = field.match(/,\s+\S/);
  if (spaceMatch) {
    issues.push({
      rule: 'space-after-comma',
      severity: 'error',
      message: 'Remove spaces after commas to save characters.',
      offendingText: spaceMatch[0],
    });
  }

  const tokens = tokenize(field);
  const stems = new Set([
    ...tokens,
    ...toSet(context.titleWords),
    ...toSet(context.subtitleWords),
  ]);
  const pluralSeen = new Set<string>();
  for (const token of tokens) {
    if (token.length > 3 && token.endsWith('s')) {
      const stem = token.slice(0, -1);
      if (stems.has(stem) && !pluralSeen.has(token)) {
        pluralSeen.add(token);
        issues.push({
          rule: 'plural-form',
          severity: 'warn',
          message: `Apple indexes both forms; "${token}" duplicates "${stem}".`,
          offendingText: token,
        });
      }
    }
  }

  const genericSeen = new Set<string>();
  for (const token of tokens) {
    if (GENERIC_WORDS.has(token) && !genericSeen.has(token)) {
      genericSeen.add(token);
      issues.push({
        rule: 'contains-generic-word',
        severity: 'error',
        message: `Generic word "${token}" wastes characters.`,
        offendingText: token,
      });
    }
  }

  issues.push(
    ...repeats(
      field,
      toSet(context.brandTokens),
      'contains-own-brand',
      'app brand name',
    ),
  );

  const competitors = toSet(context.competitorNames);
  const competitorSeen = new Set<string>();
  for (const token of tokens) {
    if (competitors.has(token) && !competitorSeen.has(token)) {
      competitorSeen.add(token);
      issues.push({
        rule: 'contains-competitor-brand',
        severity: 'error',
        message: `"${token}" is a competitor brand name (policy violation).`,
        offendingText: token,
      });
    }
  }

  return issues;
}

export function lintDescription(
  description: string,
  limit = 4000,
): LintIssue[] {
  const issues: LintIssue[] = [...overLimit(description, limit)];
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return issues;
  }

  if (WEAK_HOOK.test(description)) {
    issues.push({
      rule: 'weak-hook',
      severity: 'warn',
      message: 'Opening with "welcome to" wastes the above-the-fold hook.',
    });
  }
  if (!CTA_PATTERN.test(description)) {
    issues.push({
      rule: 'no-cta',
      severity: 'info',
      message: 'No clear call to action detected.',
    });
  }
  if (!SOCIAL_PROOF_PATTERN.test(description)) {
    issues.push({
      rule: 'no-social-proof',
      severity: 'info',
      message: 'No social proof (awards, press, user counts) detected.',
    });
  }
  if (!/[\n•‣▪·]/.test(description)) {
    issues.push({
      rule: 'no-formatting',
      severity: 'info',
      message: 'No line breaks or bullets; add formatting for readability.',
    });
  }
  return issues;
}
