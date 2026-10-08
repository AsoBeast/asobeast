import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_ROOT = join(__dirname, '..');
const READS =
  'findFirst|findFirstOrThrow|findMany|findUnique|findUniqueOrThrow|count|aggregate|groupBy|updateMany';
const CALL_PATTERN = new RegExp(
  `\\b(?:appSnapshot|changeEvent)\\.(?:${READS})\\(`,
  'g',
);
const RELATION_PATTERN = /\b(?:snapshots|changeEvents)\s*:/g;
const QUERY_OBJECT = /\b(?:include|select)\s*:\s*$/;
const QUERY_ARGS =
  /^\s*(?:true\b|\{[\s\S]*(?:\b(?:where|orderBy|take|select|distinct)\s*:|\.\.\.))/;
const SCOPE_PATTERN =
  /HOME_LISTING|HOME_EVENTS|EVERY_LISTING|listingIn\(|eventsIn\(|eventsOfMarket\(|latestListingIn\(/;
const OWNERS = new Set([
  'account/export-tables.ts',
  'apps/listing.ts',
  'jobs/retention.service.ts',
]);
const OPENERS: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
const CLOSERS = new Set(Object.values(OPENERS));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    const isSource =
      entry.name.endsWith('.ts') && !/\.(spec|fixture)\.ts$/.test(entry.name);
    return isSource ? [path] : [];
  });
}

function balancedEnd(text: string, open: number): number {
  const stack: string[] = [];
  for (let index = open; index < text.length; index++) {
    const char = text[index];
    if (char in OPENERS) stack.push(OPENERS[char]);
    else if (CLOSERS.has(char) && stack.pop() !== char) return index;
    if (stack.length === 0) return index + 1;
  }
  return text.length;
}

function valueEnd(text: string, start: number): number {
  let depth = 0;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (char in OPENERS) depth++;
    else if (CLOSERS.has(char)) {
      if (depth === 0) return index;
      depth--;
    } else if ((char === ',' || char === ';') && depth === 0) return index;
  }
  return text.length;
}

function enclosingOpen(text: string, position: number): number {
  let depth = 0;
  for (let index = position - 1; index >= 0; index--) {
    const char = text[index];
    if (CLOSERS.has(char)) depth++;
    else if (char in OPENERS) {
      if (depth === 0) return char === '{' ? index : -1;
      depth--;
    }
  }
  return -1;
}

function unscopedReadsIn(text: string): number[] {
  const calls = [...text.matchAll(CALL_PATTERN)].map((match) => {
    const open = (match.index ?? 0) + match[0].length - 1;
    return {
      at: match.index ?? 0,
      body: text.slice(open, balancedEnd(text, open)),
    };
  });
  const relations = [...text.matchAll(RELATION_PATTERN)].flatMap((match) => {
    const at = match.index ?? 0;
    const start = at + match[0].length;
    const body = text.slice(start, valueEnd(text, start));
    const open = enclosingOpen(text, at);
    const inQuery = open >= 0 && QUERY_OBJECT.test(text.slice(0, open));
    return inQuery || QUERY_ARGS.test(body) ? [{ at, body }] : [];
  });
  return [...calls, ...relations]
    .filter(({ body }) => !SCOPE_PATTERN.test(body))
    .map(({ at }) => text.slice(0, at).split('\n').length)
    .sort((a, b) => a - b);
}

function unscopedReads(path: string): string[] {
  const file = relative(SOURCE_ROOT, path);
  if (OWNERS.has(file)) return [];
  return unscopedReadsIn(readFileSync(path, 'utf8')).map(
    (line) => `${file}:${line}`,
  );
}

describe('listing reads', () => {
  it('scope every read of a snapshot or a change event to a market', () => {
    expect(sourceFiles(SOURCE_ROOT).flatMap(unscopedReads)).toEqual([]);
  });

  it.each([
    ['a unique read', 'prisma.appSnapshot.findUnique({ where: { id } })'],
    [
      'a throwing read',
      'tx.appSnapshot.findFirstOrThrow({ where: { appId } })',
    ],
    [
      'a unique throwing read',
      'tx.changeEvent.findUniqueOrThrow({ where: { id } })',
    ],
    [
      'an aggregate of events',
      'prisma.changeEvent.aggregate({ _max: { capturedAt: true } })',
    ],
    [
      'every snapshot of an app',
      'prisma.app.findMany({ include: { snapshots: true } })',
    ],
    [
      'a snapshot count',
      'prisma.app.findMany({ select: { _count: { select: { snapshots: true } } } })',
    ],
    [
      'the events of an app',
      'prisma.app.findFirst({ include: { changeEvents: { orderBy: { capturedAt: "desc" } } } })',
    ],
    [
      'a selected snapshot',
      'prisma.app.findMany({ select: { snapshots: { select: { title: true }, orderBy: NEWEST_FIRST, take: 1 } } })',
    ],
  ])('names %s that skips the market filter', (_name, source) => {
    expect(unscopedReadsIn(source)).toEqual([1]);
  });

  it('keeps a scope of one call from covering its neighbour', () => {
    const source = [
      'await prisma.appSnapshot.findMany({ where: { appId } });',
      'await prisma.appSnapshot.findFirst({ where: { appId, ...HOME_LISTING } });',
    ].join('\n');

    expect(unscopedReadsIn(source)).toEqual([1]);
  });

  it('accepts a relation load that names its market', () => {
    const source = [
      'prisma.app.findMany({',
      '  include: { snapshots: LATEST_HOME_LISTING },',
      '  select: { snapshots: latestListingIn(home, market), _count: { select: { snapshots: { where: HOME_LISTING } } } },',
      '});',
    ].join('\n');

    expect(unscopedReadsIn(source)).toEqual([]);
  });

  it('names a relation load built outside a query object', () => {
    const source = [
      'const select = () => ({',
      '  snapshots: { orderBy: NEWEST_FIRST, take: 1 },',
      '});',
    ].join('\n');

    expect(unscopedReadsIn(source)).toEqual([2]);
  });

  it('ignores a snapshots key outside a query', () => {
    const source = [
      'interface Loaded { snapshots: AppSnapshot[] }',
      'type Row = { snapshots: { title: string; ratingAvg: number | null }[] };',
      'const rival = { ...app, snapshots: latest.get(app.id) ?? [] };',
    ].join('\n');

    expect(unscopedReadsIn(source)).toEqual([]);
  });
});
