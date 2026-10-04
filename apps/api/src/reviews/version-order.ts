const NUMBERED_VERSION = /^v?(\d+(?:\.\d+)*)(.*)$/i;
const NATURAL_ORDER = new Intl.Collator('en', { numeric: true });

interface ParsedVersion {
  segments: string[];
  suffix: string;
}

function parse(raw: string): ParsedVersion | null {
  const match = NUMBERED_VERSION.exec(raw.trim());
  if (!match) return null;
  return { segments: match[1].split('.'), suffix: match[2].trim() };
}

function compareSegments(left: string, right: string): number {
  const a = left.replace(/^0+(?=\d)/, '');
  const b = right.replace(/^0+(?=\d)/, '');
  if (a.length !== b.length) return a.length - b.length;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compareSuffixes(left: string, right: string): number {
  if (left === right) return 0;
  if (left === '') return 1;
  if (right === '') return -1;
  return NATURAL_ORDER.compare(left, right);
}

function compareParsed(left: ParsedVersion, right: ParsedVersion): number {
  const length = Math.max(left.segments.length, right.segments.length);
  for (let index = 0; index < length; index += 1) {
    const difference = compareSegments(
      left.segments[index] ?? '0',
      right.segments[index] ?? '0',
    );
    if (difference !== 0) return difference;
  }
  return compareSuffixes(left.suffix, right.suffix);
}

export function compareVersions(left: string, right: string): number {
  const parsedLeft = parse(left);
  const parsedRight = parse(right);
  if (parsedLeft && parsedRight) {
    return (
      compareParsed(parsedLeft, parsedRight) ||
      NATURAL_ORDER.compare(left, right)
    );
  }
  if (parsedLeft) return 1;
  if (parsedRight) return -1;
  return NATURAL_ORDER.compare(left, right);
}

export function sortVersionsNewestFirst(versions: readonly string[]): string[] {
  return [...versions].sort((left, right) => compareVersions(right, left));
}
