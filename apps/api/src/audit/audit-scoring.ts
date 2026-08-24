import { KeywordSource, Store } from '@prisma/client';
import {
  AuditAiStatus,
  AuditCheckKind,
  AuditCheckResult,
  AuditCheckStatus,
  KeywordBucket,
  LintIssue,
  tokenize,
} from '@asobeast/shared';
import { clamp } from '../scoring/formulas';
import { RawAppFacts } from '../store-providers/raw-facts';
import { AiAuditChecks } from './audit-ai.service';

export interface AuditKeyword {
  text: string;
  source: KeywordSource;
  bucket: KeywordBucket | null;
  relevance: number;
  position: number | null;
}

export interface AuditContext {
  appId: string;
  store: Store;
  title: string;
  subtitle: string | null;
  description: string;
  ratingAvg: number | null;
  ratingCount: number | null;
  storeUpdatedAt: Date | null;
  now: Date;
  rawFacts: RawAppFacts;
  keywords: AuditKeyword[];
  rankings: {
    top10Share: number;
    rankedShare: number;
    avgDelta7d: number | null;
    gapCount: number;
  };
  history: {
    ratingAvgDelta30d: number | null;
    ratingCountDelta30d: number | null;
  };
  competitorTitles: string[];
  competitorNames: string[];
  brandTokens: string[];
  aiChecks: AiAuditChecks;
  aiStatus: AuditAiStatus;
}

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

export const check = (
  id: string,
  label: string,
  kind: AuditCheckKind,
  score: number | null,
  detail: string,
): AuditCheckResult => ({
  id,
  label,
  kind,
  score,
  status: statusFromScore(score),
  detail,
});

export const aiCheck = (
  id: string,
  label: string,
  ai: AiAuditChecks,
): AuditCheckResult => {
  const found = ai[id];
  if (!found) {
    return check(id, label, 'ai', null, 'Run the AI audit to score this.');
  }
  const score = found.score === null ? null : clamp(found.score, 0, 10);
  return check(id, label, 'ai', score, found.detail);
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

export const bucketTexts = (
  keywords: AuditKeyword[],
  bucket: KeywordBucket,
): string[] =>
  keywords.filter((keyword) => keyword.bucket === bucket).map((k) => k.text);

export const lintContext = (context: AuditContext) => ({
  titleWords: tokenize(context.title),
  subtitleWords: tokenize(context.subtitle ?? ''),
  brandTokens: context.brandTokens,
  competitorNames: context.competitorNames,
});
