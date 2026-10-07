import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_ROOT = join(__dirname, '..');
const READ_PATTERN =
  /appSnapshot\.(?:findFirst|findMany|count|updateMany|aggregate|groupBy)\(|snapshots: \{\s*(?:orderBy|where|\.\.\.)|changeEvent\.(?:findFirst|findMany|count|groupBy)\(/g;
const SCOPE_PATTERN =
  /HOME_LISTING|HOME_EVENTS|EVERY_LISTING|listingIn\(|eventsIn\(|latestListingIn\(/;
const CALL_LINES = 14;
const OWNERS = new Set([
  'account/export-tables.ts',
  'apps/listing.ts',
  'jobs/retention.service.ts',
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    const isSource =
      entry.name.endsWith('.ts') && !/\.(spec|fixture)\.ts$/.test(entry.name);
    return isSource ? [path] : [];
  });
}

function unscopedReads(path: string): string[] {
  const file = relative(SOURCE_ROOT, path);
  if (OWNERS.has(file)) return [];
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  return [...text.matchAll(READ_PATTERN)].flatMap((match) => {
    const line = text.slice(0, match.index ?? 0).split('\n').length;
    const call = lines.slice(line - 1, line - 1 + CALL_LINES).join('\n');
    return SCOPE_PATTERN.test(call) ? [] : [`${file}:${line}`];
  });
}

describe('listing reads', () => {
  it('scope every read of a snapshot or a change event to a market', () => {
    expect(sourceFiles(SOURCE_ROOT).flatMap(unscopedReads)).toEqual([]);
  });
});
