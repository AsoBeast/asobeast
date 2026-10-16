import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  decodeCsv,
  parseCsv,
  pivotCountryFile,
  pivotTrafficFile,
  playSourceOf,
  PlayHeaderError,
  searchTermsOf,
} from './play-store-performance';

const fixture = (name: string): Buffer =>
  readFileSync(join(__dirname, '..', 'fixtures', 'play', name));

const COUNTRY = fixture(
  'store_performance_com.example.habits_202609_country.csv',
);
const TRAFFIC = fixture(
  'store_performance_com.example.habits_202609_traffic_source.csv',
);

describe('decodeCsv', () => {
  it('decodes UTF-16LE with a byte order mark and UTF-8 alike', () => {
    const utf16 = decodeCsv(COUNTRY);
    const utf8 = decodeCsv(fixture('store_performance_utf8_country.csv'));

    expect(utf16.startsWith('Date,Package name')).toBe(true);
    expect(utf16.replace(/\r\n/g, '\n')).toBe(utf8);
  });

  it('decodes UTF-16BE and strips a UTF-8 byte order mark', () => {
    const text = 'Date,Country\n2026-09-01,PL\n';
    const be = Buffer.from(text, 'utf16le');
    be.swap16();

    expect(decodeCsv(Buffer.concat([Buffer.from([0xfe, 0xff]), be]))).toBe(
      text,
    );
    expect(decodeCsv(Buffer.from(`\uFEFF${text}`))).toBe(text);
  });
});

describe('parseCsv', () => {
  it('splits quoted cells with doubled quotes, embedded commas and line breaks', () => {
    expect(parseCsv('a,"b, c","say ""hi""","two\nlines"\r\n1,2,3,4\n')).toEqual(
      [
        ['a', 'b, c', 'say "hi"', 'two\nlines'],
        ['1', '2', '3', '4'],
      ],
    );
  });

  it('reads a tab separated file by its header', () => {
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('drops empty lines', () => {
    expect(parseCsv('a,b\n\n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('pivotCountryFile', () => {
  it('reads rows keyed by date and country, with visitors and acquisitions and the ratio ignored', () => {
    const rows = pivotCountryFile(parseCsv(decodeCsv(COUNTRY)), '2026-10-15');

    expect(rows).toHaveLength(4);
    expect(
      rows.find((row) => row.date === '2026-09-02' && row.country === 'de'),
    ).toEqual({
      date: '2026-09-02',
      territory: 'de',
      country: 'de',
      sourceType: 'all',
      pageType: 'productPage',
      impressions: 0,
      uniqueImpressions: 0,
      pageViews: 3400,
      uniquePageViews: 3400,
      gets: 1200,
      uniqueGets: 1200,
      processingDate: '2026-10-15',
    });
  });

  it('refuses a header missing a required column by name and ignores extra columns', () => {
    expect(() =>
      pivotCountryFile(
        parseCsv('Date,Country,Store listing visitors\n'),
        '2026-10-15',
      ),
    ).toThrow(PlayHeaderError);
    expect(() =>
      pivotCountryFile(
        parseCsv('Date,Country,Store listing visitors\n'),
        '2026-10-15',
      ),
    ).toThrow('Store listing acquisitions');
    const extra = pivotCountryFile(
      parseCsv(
        'Date,Unique install clicks,Country,Store listing acquisitions,Store listing visitors\n2026-09-01,9,US,4,80\n',
      ),
      '2026-10-15',
    );
    expect(extra[0]).toMatchObject({ country: 'us', gets: 4, pageViews: 80 });
  });
});

describe('pivotTrafficFile', () => {
  it('reads rows keyed by date and source under the all markets sentinel', () => {
    const rows = pivotTrafficFile(parseCsv(decodeCsv(TRAFFIC)), '2026-10-15');
    const searchFirst = rows.find(
      (row) => row.date === '2026-09-01' && row.sourceType === 'search',
    );

    expect(searchFirst).toMatchObject({
      territory: 'all',
      country: null,
      pageViews: 590,
      gets: 35,
    });
    expect(rows.map((row) => `${row.date} ${row.sourceType}`).sort()).toEqual([
      '2026-09-01 browse',
      '2026-09-01 referrer',
      '2026-09-01 search',
      '2026-09-02 search',
    ]);
  });

  it.each([
    ['Google Play search', 'search'],
    ['Google Play explore', 'browse'],
    ['Third-party referrers', 'referrer'],
    ['Google Ads', 'other'],
  ])('maps the traffic source %s', (raw, mapped) => {
    expect(playSourceOf(raw)).toBe(mapped);
  });
});

describe('searchTermsOf', () => {
  it('sums each search term across the month and skips Other', () => {
    const terms = searchTermsOf(parseCsv(decodeCsv(TRAFFIC)));

    expect(terms).toEqual([
      {
        month: '2026-09-01',
        term: 'habit tracker',
        normalized: 'habit tracker',
        visitors: 1020,
        acquisitions: 65,
      },
      {
        month: '2026-09-01',
        term: 'Habit  Tracker',
        normalized: 'habit tracker',
        visitors: 10,
        acquisitions: 1,
      },
    ]);
  });
});
