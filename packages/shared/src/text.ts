export const STOPWORDS: ReadonlySet<string> = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'can',
  'cannot',
  'could',
  'did',
  'do',
  'does',
  'doing',
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'itself',
  'me',
  'more',
  'most',
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'same',
  'she',
  'should',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'would',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
  'app',
  'apps',
  'free',
  'best',
  'new',
  'official',
  'get',
  'download',
]);

const DOTTED_SMALL_I = 'i\u0307';

export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replaceAll(DOTTED_SMALL_I, 'i')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .replace(/(^| )\p{M}+/gu, '$1')
    .trim()
    .replace(/\s+/g, ' ');
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  return normalized.length === 0 ? [] : normalized.split(' ');
}

export function isStopword(token: string): boolean {
  return STOPWORDS.has(token);
}

const ACCENTED_LETTER = /([\p{Script=Latin}\p{Script=Greek}])\p{M}+/gu;

export function searchKey(input: string): string {
  return normalizeText(input)
    .normalize('NFKD')
    .replace(ACCENTED_LETTER, '$1')
    .normalize('NFC');
}
