const APOSTROPHE = String.raw`['\u2019\u02BC\u00B4\uFF07]`;
const LATIN_OR_DIGIT = String.raw`[\p{Script=Latin}\p{N}]`;
const WORD_END = String.raw`(?![\p{L}\p{N}])`;
const NUMBER_JOINER = String.raw`[.,:/\u00A0\u2007\u2009\u202F'\u2019\uFF0C\uFF0E\uFF0F\u066B\u066C]`;

const NEGATED_AUXILIARY = new RegExp(
  String.raw`(?<![\p{L}\p{N}])\p{L}+n${APOSTROPHE}t${WORD_END}`,
  'giu',
);
const CONTRACTION_SUFFIX = new RegExp(
  String.raw`(?<=\p{L})${APOSTROPHE}(?:ll|re|ve|[sdm])${WORD_END}`,
  'giu',
);
const SEGMENT_SEPARATORS = new RegExp(
  String.raw`[:.,|&]|(?<!${LATIN_OR_DIGIT})\p{Nd}+(?:${NUMBER_JOINER}\p{Nd}+)+${LATIN_OR_DIGIT}*`,
  'u',
);

const withoutContractions = (text: string): string =>
  text.replace(NEGATED_AUXILIARY, ' ').replace(CONTRACTION_SUFFIX, '');

export const listingSegments = (text: string): string[] =>
  withoutContractions(text).split(SEGMENT_SEPARATORS);
