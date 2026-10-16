import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  DiscoveryHeaderError,
  pageTypeOf,
  pivotDiscoveryReport,
  sourceTypeOf,
} from './discovery-report';

const FIXTURE = readFileSync(
  join(__dirname, 'fixtures', 'asc', 'discovery-standard.tsv'),
  'utf8',
);

const pivot = (text: string) =>
  pivotDiscoveryReport(gzipSync(Buffer.from(text)), '2026-09-12');

describe('pivotDiscoveryReport', () => {
  it('sums device and platform rows into one funnel key', async () => {
    const rows = await pivot(FIXTURE);
    const usSearch = rows.find(
      (row) =>
        row.date === '2026-09-10' &&
        row.territory === 'United States' &&
        row.sourceType === 'search' &&
        row.pageType === 'noPage',
    );

    expect(usSearch).toMatchObject({
      impressions: 1500,
      uniqueImpressions: 1150,
      pageViews: 0,
      gets: 0,
    });
  });

  it('maps events to counters and ignores an open tap', async () => {
    const rows = await pivot(FIXTURE);
    const usProduct = rows.find(
      (row) =>
        row.date === '2026-09-10' &&
        row.territory === 'United States' &&
        row.pageType === 'productPage',
    );

    expect(usProduct).toEqual({
      date: '2026-09-10',
      territory: 'United States',
      sourceType: 'search',
      pageType: 'productPage',
      impressions: 0,
      uniqueImpressions: 0,
      pageViews: 240,
      uniquePageViews: 200,
      gets: 60,
      uniqueGets: 55,
      processingDate: '2026-09-12',
    });
  });

  it('keeps one row per date, territory, source and page type', async () => {
    const rows = await pivot(FIXTURE);

    expect(rows).toHaveLength(7);
    expect(rows.every((row) => row.processingDate === '2026-09-12')).toBe(true);
  });

  it('reads the header by name and ignores unknown columns', async () => {
    const withCampaign = FIXTURE.split('\n')
      .map((line, index) =>
        line.length === 0
          ? line
          : `${index === 0 ? 'Campaign' : 'spring'}\t${line}`,
      )
      .join('\n');

    await expect(pivot(withCampaign)).resolves.toEqual(await pivot(FIXTURE));
  });

  it('reads windows line endings and a byte order mark', async () => {
    await expect(
      pivot(`\uFEFF${FIXTURE.replace(/\n/g, '\r\n')}`),
    ).resolves.toEqual(await pivot(FIXTURE));
  });

  it('refuses a header missing a required column', async () => {
    const missing = FIXTURE.replace('Unique Counts', 'Uniques');

    await expect(pivot(missing)).rejects.toThrow(DiscoveryHeaderError);
    await expect(pivot(missing)).rejects.toThrow('Unique Counts');
  });

  it('parses a gzip stream of two members', async () => {
    const [header, ...lines] = FIXTURE.trim().split('\n');
    const first = gzipSync(
      Buffer.from(`${header}\n${lines.slice(0, 6).join('\n')}\n`),
    );
    const second = gzipSync(Buffer.from(`${lines.slice(6).join('\n')}\n`));

    await expect(
      pivotDiscoveryReport(Buffer.concat([first, second]), '2026-09-12'),
    ).resolves.toEqual(await pivot(FIXTURE));
  });

  it('accepts a month first date', async () => {
    const rows = await pivot(FIXTURE.replace(/2026-09-10/g, '09/10/2026'));

    expect(rows.some((row) => row.date === '2026-09-10')).toBe(true);
  });

  it('skips a row whose date or counts cannot be read', async () => {
    const broken = `${FIXTURE}not a date\tFocus Timer\t1\tImpression\tNo page\tApp Store search\t\tiPhone\tiOS\tUnited States\t5\t5\n2026-09-11\tFocus Timer\t1\tImpression\tNo page\tApp Store search\t\tiPhone\tiOS\tUnited States\tmany\t5\n`;

    await expect(pivot(broken)).resolves.toEqual(await pivot(FIXTURE));
  });

  it('parses in bounded memory through the stream', async () => {
    const [header] = FIXTURE.split('\n');
    const line =
      '2026-09-10\tFocus Timer\t1\tImpression\tNo page\tApp Store search\t\tiPhone\tiOS 18.0\tUnited States\t1\t1\n';
    const big = gzipSync(Buffer.from(`${header}\n${line.repeat(200_000)}`));

    const rows = await pivotDiscoveryReport(big, '2026-09-12');

    expect(rows).toHaveLength(1);
    expect(rows[0].impressions).toBe(200_000);
  });

  it('answers no rows for an empty file', async () => {
    await expect(
      pivotDiscoveryReport(Buffer.alloc(0), '2026-09-12'),
    ).resolves.toEqual([]);
  });
});

describe('funnel dimensions', () => {
  it.each([
    ['App Store search', 'search'],
    ['App Store browse', 'browse'],
    ['App referrer', 'referrer'],
    ['Web referrer', 'referrer'],
    ['App Clip', 'other'],
    ['Unavailable', 'other'],
  ])('maps the source type %s', (raw, mapped) => {
    expect(sourceTypeOf(raw)).toBe(mapped);
  });

  it.each([
    ['Product page', 'productPage'],
    ['No page', 'noPage'],
    ['In-app event', 'inAppEvent'],
    ['Store sheet', 'storeSheet'],
    ['Media view', 'other'],
  ])('maps the page type %s', (raw, mapped) => {
    expect(pageTypeOf(raw)).toBe(mapped);
  });
});
