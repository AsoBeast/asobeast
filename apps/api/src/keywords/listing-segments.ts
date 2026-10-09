const APOSTROPHE = String.raw`['\u2019\u02BC]`;
const NOT_WORD_EDGE = String.raw`(?![\p{L}\p{N}])`;
const NUMBER_JOINER = String.raw`[.,/\u00A0\u2007\u2009\u202F'\u2019\uFF0C\uFF0E\uFF0F]`;

const NEGATED_AUXILIARY = new RegExp(
  String.raw`(?<![\p{L}\p{N}])\p{L}+n${APOSTROPHE}t${NOT_WORD_EDGE}`,
  'giu',
);
const CONTRACTION_SUFFIX = new RegExp(
  String.raw`(?<=\p{L})${APOSTROPHE}(?:ll|re|ve|[sdm])${NOT_WORD_EDGE}`,
  'giu',
);
const SEGMENT_SEPARATORS = new RegExp(
  String.raw`[:.,|&]|\p{Nd}+(?:${NUMBER_JOINER}\p{Nd}+)+`,
  'u',
);

const withoutContractions = (text: string): string =>
  text.replace(NEGATED_AUXILIARY, ' ').replace(CONTRACTION_SUFFIX, '');

export const listingSegments = (text: string): string[] =>
  withoutContractions(text).split(SEGMENT_SEPARATORS);
