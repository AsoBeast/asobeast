import {
  QUERY_BOUNDS,
  REVIEW_THEME_KINDS,
  ReviewTheme,
  ReviewThemeKind,
  tokenize,
} from '@asobeast/shared';
import { MinableReview, reviewPhrases } from '../keywords/review-mining';
import { reviewLanguages } from './review-language';

export const REVIEW_THEMES_CAP = QUERY_BOUNDS.reviewsLimit.max;
export const REVIEW_THEME_MIN_REVIEWS = 2;
export const REVIEW_THEME_LIMITS: Record<ReviewThemeKind, number> = {
  complaint: 6,
  praise: 4,
};
export const REVIEW_THEME_SURPRISE = 2;

const THEME_MAX_WORDS = 4;
const SHADOW_SHARE = 0.75;
const HALF = 0.5;

const IGNORED_WORDS = `
  app apps application game games
  good great love loved like liked nice amazing awesome best better cool fun
  bad worse worst hate terrible awful horrible perfect excellent favorite
  favourite beautiful wonderful fantastic enjoy enjoyed recommend thanks thank
  star stars five
  use used using get gets got getting make made makes want wants wanted need
  needs try trying tried said say says know think see seen way thing things
  lot lots many without always never since later time times day days keep
  keeps kept first new back work works
  working worked play played playing plays people everything anything
  something nothing someone everyone experience give gave come came go going
  went take took look looks put let lets able add added help
  cant dont wont doesnt didnt isnt wasnt arent im ive id youre theres thats
`
  .split(/\s+/)
  .filter(Boolean);

export interface ThemeReview extends MinableReview {
  id: string;
  score: number;
}

export interface ThemeOptions {
  languages: readonly string[];
  negativeScoreMax: number;
  ignored: ReadonlySet<string>;
}

interface Counts {
  mentions: number;
  negative: number;
}

interface Judgement {
  phrase: string;
  kind: ReviewThemeKind;
  surprise: number;
}

interface Candidate extends Judgement, Counts {}

export function themeIgnoredWords(appName: string | null): Set<string> {
  return new Set([...IGNORED_WORDS, ...tokenize(appName ?? '')]);
}

type PhraseReader = (review: ThemeReview) => Set<string>;

function phraseReader(options: ThemeOptions): PhraseReader {
  const read = new Map<string, Set<string>>();
  return (review) => {
    const known = read.get(review.id);
    if (known) return known;
    const detected = reviewLanguages(`${review.title ?? ''} ${review.text}`);
    const languages = [...new Set([...options.languages, ...detected])];
    const phrases = reviewPhrases(review, languages, {
      maxWords: THEME_MAX_WORDS,
      ignored: options.ignored,
    });
    read.set(review.id, phrases);
    return phrases;
  };
}

function countsOf(
  reviews: readonly ThemeReview[],
  negativeScoreMax: number,
  phrasesOf: PhraseReader,
): Map<string, Counts> {
  const counts = new Map<string, Counts>();
  for (const review of reviews) {
    const negative = review.score <= negativeScoreMax ? 1 : 0;
    for (const phrase of phrasesOf(review)) {
      const count = counts.get(phrase) ?? { mentions: 0, negative: 0 };
      count.mentions += 1;
      count.negative += negative;
      counts.set(phrase, count);
    }
  }
  return counts;
}

function surpriseOf({ mentions, negative }: Counts, rate: number): number {
  return (negative - mentions * rate) / Math.sqrt(mentions * rate * (1 - rate));
}

function kindOf(
  { mentions, negative }: Counts,
  rate: number,
  surprise: number,
): ReviewThemeKind | null {
  const share = negative / mentions;
  const mostlyLow = rate >= HALF;
  const complaint = mostlyLow
    ? share >= rate
    : surprise >= REVIEW_THEME_SURPRISE;
  const praise = mostlyLow ? surprise <= -REVIEW_THEME_SURPRISE : share <= rate;
  if (complaint && negative >= REVIEW_THEME_MIN_REVIEWS) return 'complaint';
  if (praise && mentions - negative >= REVIEW_THEME_MIN_REVIEWS) {
    return 'praise';
  }
  return null;
}

function judgementsOf(
  baseline: readonly ThemeReview[],
  negativeScoreMax: number,
  phrasesOf: PhraseReader,
): Judgement[] {
  const negative = baseline.filter(
    (review) => review.score <= negativeScoreMax,
  ).length;
  const rate = (negative + 1) / (baseline.length + 2);
  return [...countsOf(baseline, negativeScoreMax, phrasesOf)].flatMap(
    ([phrase, counts]) => {
      const surprise = surpriseOf(counts, rate);
      const kind = kindOf(counts, rate, surprise);
      return kind ? [{ phrase, kind, surprise }] : [];
    },
  );
}

function shorterPhrasesOf(phrase: string): string[] {
  const tokens = phrase.split(' ');
  const shorter: string[] = [];
  for (let size = 1; size < tokens.length; size += 1) {
    for (let start = 0; start + size <= tokens.length; start += 1) {
      shorter.push(tokens.slice(start, start + size).join(' '));
    }
  }
  return shorter;
}

function withoutShadowed(candidates: Candidate[]): Candidate[] {
  const byPhrase = new Map(candidates.map((theme) => [theme.phrase, theme]));
  const shadowed = new Set<string>();
  for (const longer of candidates) {
    for (const phrase of shorterPhrasesOf(longer.phrase)) {
      const shorter = byPhrase.get(phrase);
      if (shorter && longer.mentions >= shorter.mentions * SHADOW_SHARE) {
        shadowed.add(phrase);
      }
    }
  }
  return candidates.filter((theme) => !shadowed.has(theme.phrase));
}

const strongestFirst = (a: Candidate, b: Candidate) =>
  Math.abs(b.surprise) - Math.abs(a.surprise) ||
  b.mentions - a.mentions ||
  a.phrase.localeCompare(b.phrase);

export function reviewThemes(
  baseline: readonly ThemeReview[],
  shown: readonly ThemeReview[],
  options: ThemeOptions,
): ReviewTheme[] {
  const phrasesOf = phraseReader(options);
  const { negativeScoreMax } = options;
  const visible = countsOf(shown, negativeScoreMax, phrasesOf);
  const candidates = judgementsOf(
    baseline,
    negativeScoreMax,
    phrasesOf,
  ).flatMap(({ phrase, kind, surprise }) => {
    const counts = visible.get(phrase);
    return counts && counts.mentions >= REVIEW_THEME_MIN_REVIEWS
      ? [{ phrase, kind, surprise, ...counts }]
      : [];
  });
  const ranked = withoutShadowed(candidates).sort(strongestFirst);
  return REVIEW_THEME_KINDS.flatMap((kind) =>
    ranked
      .filter((candidate) => candidate.kind === kind)
      .slice(0, REVIEW_THEME_LIMITS[kind])
      .map(({ phrase, mentions, negative }) => ({
        phrase,
        kind,
        mentions,
        negative,
      })),
  );
}
