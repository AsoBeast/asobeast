const LINE_BREAK = /<br\s*\/?>|\r\n?/gi;
const TAG = /<\/?[a-z][^>]*>/gi;
const CUT_TAG = /<\/?[a-z][^<>]*?(…?)$/i;
const ENTITY = /&(#x[\da-f]+|#\d+|[a-z]+);/gi;
const MAX_CODE_POINT = 0x10ffff;
const SURROGATE_START = 0xd800;
const SURROGATE_END = 0xdfff;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function isCharacter(codePoint: number): boolean {
  return (
    codePoint > 0 &&
    codePoint <= MAX_CODE_POINT &&
    (codePoint < SURROGATE_START || codePoint > SURROGATE_END)
  );
}

function decodeEntity(match: string, body: string): string {
  if (!body.startsWith('#')) {
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  }
  const hex = body[1] === 'x' || body[1] === 'X';
  const codePoint = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
  return isCharacter(codePoint) ? String.fromCodePoint(codePoint) : match;
}

function stripTags(value: string): string {
  let previous: string;
  let stripped = value;
  do {
    previous = stripped;
    stripped = previous.replace(TAG, '');
  } while (stripped !== previous);
  return stripped;
}

export function releaseNotesText(value: string): string {
  return stripTags(value.replace(LINE_BREAK, '\n'))
    .replace(CUT_TAG, '$1')
    .replace(ENTITY, decodeEntity)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}
