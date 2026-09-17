import { KeywordSource, Store } from '@prisma/client';
import {
  AuditAiStatus,
  AuditCheckResult,
  AuditCheckSource,
  AuditCheckStatus,
  AuditUnlock,
  KeywordBucket,
  KeywordComparison,
  LintIssue,
  normalizeText,
  tokenize,
} from '@asobeast/shared';
import { clamp } from '../scoring/formulas';
import { round1 } from './audit-engine';
import { RawAppFacts } from '../store-providers/raw-facts';
import { AiAuditChecks } from './audit-ai.service';

export interface AuditKeyword {
  text: string;
  source: KeywordSource;
  bucket: KeywordBucket | null;
  relevance: number;
  position: number | null;
  traffic: number | null;
  volume: number | null;
  opportunity: number | null;
}

export interface AuditCompetitor {
  id: string;
  name: string | null;
  title: string | null;
  subtitle: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  screenshotCount: number | null;
  hasVideo: boolean;
  iconUrl: string | null;
  storeUpdatedAt: Date | null;
}

export interface AuditReview {
  score: number;
  title: string | null;
  text: string;
  reviewedAt: Date | null;
}

export interface AuditVisibility {
  latest: number | null;
  latestDate: string | null;
  weekAgo: number | null;
}

export interface AuditContext {
  appId: string;
  store: Store;
  country: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  description: string;
  keywordField: string | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  storeUpdatedAt: Date | null;
  now: Date;
  rawFacts: RawAppFacts;
  keywords: AuditKeyword[];
  visibility: AuditVisibility;
  comparison: KeywordComparison;
  competitors: AuditCompetitor[];
  reviews: AuditReview[];
  reviewScoreMax: number;
  brandTokens: string[];
  aiChecks: AiAuditChecks;
  aiStatus: AuditAiStatus;
}

export type BrandTier = 'dominant' | 'established' | 'challenger';

export const DOMINANT_RATING_COUNT = 1_000_000;
export const ESTABLISHED_RATING_COUNT = 100_000;

export const brandTier = (ratingCount: number | null): BrandTier => {
  if (ratingCount === null) return 'challenger';
  if (ratingCount >= DOMINANT_RATING_COUNT) return 'dominant';
  return ratingCount >= ESTABLISHED_RATING_COUNT ? 'established' : 'challenger';
};

export const TITLE_FULL_CHARS = 27;
export const TITLE_PARTIAL_CHARS = 20;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const FRESH_DAYS = 30;

export const statusFromScore = (score: number | null): AuditCheckStatus => {
  if (score === null) return 'unanswered';
  if (score >= 7) return 'pass';
  if (score >= 4) return 'warn';
  return 'fail';
};

export type AuditCheckId =
  | 'title-keyword'
  | 'title-length'
  | 'title-policy'
  | 'title-uniqueness'
  | 'subtitle-keyword'
  | 'subtitle-no-repetition'
  | 'subtitle-length'
  | 'keyword-field-saved'
  | 'keyword-field-hygiene'
  | 'keyword-field-bytes'
  | 'keyword-field-relevance'
  | 'short-description-keyword'
  | 'short-description-length'
  | 'short-description-no-repetition'
  | 'short-description-policy'
  | 'description-hook'
  | 'description-cta'
  | 'description-social-proof'
  | 'description-formatting'
  | 'screenshots-count'
  | 'screenshots-ipad'
  | 'screenshots-feature-graphic'
  | 'screenshots-first-three'
  | 'screenshots-text-overlays'
  | 'screenshots-consistent'
  | 'screenshots-localized'
  | 'screenshots-device-frames'
  | 'preview-video-present'
  | 'ratings-average'
  | 'ratings-volume'
  | 'ratings-recent'
  | 'ratings-current-version'
  | 'icon-distinctive'
  | 'icon-simple'
  | 'icon-category-fit'
  | 'icon-no-text'
  | 'rankings-visibility'
  | 'rankings-top10'
  | 'rankings-trend'
  | 'rankings-competitor-gap'
  | 'conversion-freshness';

export interface CheckAdvice {
  title: string;
  fix: string;
}

export interface RubricCheck extends AuditCheckResult {
  id: AuditCheckId;
  weight: number;
  source: AuditCheckSource;
  unlock: AuditUnlock | null;
  advice: CheckAdvice | null;
}

export interface CheckInput {
  id: AuditCheckId;
  label: string;
  source: AuditCheckSource;
  weight: number;
  score: number | null;
  detail: string;
  heuristic?: boolean;
  unlock?: AuditUnlock | null;
  advice?: CheckAdvice | null;
}

export const check = (input: CheckInput): RubricCheck => {
  const score = input.score === null ? null : round1(clamp(input.score, 0, 10));
  const status = statusFromScore(score);
  return {
    id: input.id,
    label: input.label,
    kind: input.source === 'ai' ? 'ai' : input.heuristic ? 'heuristic' : 'auto',
    source: input.source,
    weight: input.weight,
    score,
    status,
    detail: input.detail,
    unlock: score === null ? (input.unlock ?? null) : null,
    advice:
      status === 'warn' || status === 'fail' ? (input.advice ?? null) : null,
  };
};

export const HISTORY_UNLOCK: AuditUnlock = {
  kind: 'history',
  label: 'Needs more daily history',
};

export const KEYWORDS_UNLOCK: AuditUnlock = {
  kind: 'keywords',
  label: 'Score your tracked keywords to find your primary keywords',
};

export const COMPETITORS_UNLOCK: AuditUnlock = {
  kind: 'competitors',
  label: 'Add competitors to compare titles',
};

export const KEYWORD_FIELD_UNLOCK: AuditUnlock = {
  kind: 'keyword-field',
  label: 'Paste your keyword field from App Store Connect',
};

export const aiUnlock = (configured: boolean): AuditUnlock => ({
  kind: 'ai-analysis',
  label: configured
    ? 'Run the AI creative analysis'
    : 'Add OPENAI_API_KEY to analyze your icon and screenshots',
});

export const aiCheck = (
  id: AuditCheckId,
  label: string,
  weight: number,
  context: AuditContext,
): RubricCheck => {
  const found = context.aiChecks[id];
  return check({
    id,
    label,
    source: 'ai',
    weight,
    score: found?.score ?? null,
    detail: found?.detail ?? 'Run the AI audit to score this.',
    unlock: aiUnlock(context.aiStatus.configured),
  });
};

export const lintScore = (issues: LintIssue[]): number => {
  let score = 10;
  for (const issue of issues) {
    if (issue.severity === 'error') score -= 4;
    else if (issue.severity === 'warn') score -= 2;
    else score -= 1;
  }
  return clamp(score, 0, 10);
};

export const charUsageScore = (
  len: number,
  full: number,
  partial: number,
): number => {
  if (len >= full) return 10;
  if (len >= partial) return 7;
  return clamp((len / partial) * 7, 0, 7);
};

export const keywordMatchScore = (
  title: string,
  keywords: string[],
): number => {
  const haystack = title.toLowerCase();
  let best = 0;
  for (const keyword of keywords) {
    const phrase = keyword.toLowerCase().trim();
    if (!phrase) continue;
    if (haystack.includes(phrase)) return 10;
    const words = phrase.split(/\s+/);
    const present = words.filter((word) => haystack.includes(word)).length;
    if (present === words.length) best = Math.max(best, 7);
    else if (present > 0) best = Math.max(best, 4);
  }
  return best;
};

export const uniquenessScore = (
  title: string,
  competitors: string[],
): number => {
  const mine = new Set(tokenize(title));
  if (competitors.length === 0 || mine.size === 0) return 10;
  let maxOverlap = 0;
  for (const competitor of competitors) {
    const theirs = new Set(tokenize(competitor));
    const shared = [...mine].filter((token) => theirs.has(token)).length;
    maxOverlap = Math.max(maxOverlap, shared / mine.size);
  }
  return clamp((1 - maxOverlap) * 10, 0, 10);
};

export const presenceShare = (fields: string, keywords: string[]): number => {
  if (keywords.length === 0) return 0;
  const haystack = fields.toLowerCase();
  const present = keywords.filter((keyword) =>
    haystack.includes(keyword.toLowerCase()),
  ).length;
  return clamp((present / keywords.length) * 10, 0, 10);
};

export const ratingAverageScore = (avg: number): number => {
  if (avg >= 4.5) return clamp(9 + (avg - 4.5) / 0.5, 9, 10);
  if (avg >= 4.0) return clamp(5 + ((avg - 4.0) / 0.5) * 3, 5, 8);
  return clamp((avg / 4.0) * 4, 0, 4);
};

export const trendScore = (
  delta: number | null,
  goodWhenPositive: boolean,
): number | null => {
  if (delta === null) return null;
  if (delta === 0) return 5;
  const good = goodWhenPositive ? delta > 0 : delta < 0;
  return good ? 10 : 0;
};

export const PRIORITY_BUCKETS = ['primary', 'secondary'] as const;

export const priorityKeywords = (keywords: AuditKeyword[]): AuditKeyword[] =>
  PRIORITY_BUCKETS.flatMap((bucket) =>
    keywords
      .filter((keyword) => keyword.bucket === bucket)
      .sort(
        (a, b) =>
          (b.opportunity ?? 0) - (a.opportunity ?? 0) ||
          a.text.localeCompare(b.text),
      ),
  );

export const coversPhrase = (field: string, phrase: string): boolean =>
  ` ${normalizeText(field)} `.includes(` ${normalizeText(phrase)} `);

export const countPhrase = (field: string, phrase: string): number =>
  ` ${normalizeText(field)} `.split(` ${normalizeText(phrase)} `).length - 1;

export const quoteList = (texts: string[], limit = 3): string =>
  texts
    .slice(0, limit)
    .map((text) => `“${text}”`)
    .join(', ');

export const bucketTexts = (
  keywords: AuditKeyword[],
  bucket: KeywordBucket,
): string[] =>
  keywords.filter((keyword) => keyword.bucket === bucket).map((k) => k.text);

export const competitorTitles = (context: AuditContext): string[] =>
  context.competitors
    .map((entry) => entry.title)
    .filter((title): title is string => Boolean(title));

export const competitorNames = (context: AuditContext): string[] =>
  context.competitors
    .map((entry) => entry.name)
    .filter((name): name is string => Boolean(name));

export const lintContext = (context: AuditContext) => ({
  titleWords: tokenize(context.title),
  subtitleWords: tokenize(context.subtitle ?? ''),
  brandTokens: [
    ...context.brandTokens,
    ...tokenize(context.rawFacts.developerName ?? ''),
  ],
  competitorNames: competitorNames(context),
});
