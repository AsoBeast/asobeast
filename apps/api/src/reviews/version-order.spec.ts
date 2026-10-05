import { compareVersions, sortVersionsNewestFirst } from './version-order';

describe('sortVersionsNewestFirst', () => {
  it('orders numeric segments as numbers, not as text', () => {
    expect(
      sortVersionsNewestFirst([
        '3.95.0',
        '3.67.0',
        '3.38.0',
        '3.123.1',
        '3.123.0',
      ]),
    ).toEqual(['3.123.1', '3.123.0', '3.95.0', '3.67.0', '3.38.0']);
  });

  it('puts a version with a longer first segment above a shorter one', () => {
    expect(sortVersionsNewestFirst(['6.12.2', '450.0.0.24.77'])).toEqual([
      '450.0.0.24.77',
      '6.12.2',
    ]);
  });

  it('compares versions with different segment counts as if padded with zeros', () => {
    expect(sortVersionsNewestFirst(['1.2', '1.2.1', '1.10'])).toEqual([
      '1.10',
      '1.2.1',
      '1.2',
    ]);
  });

  it('keeps equal versions together in a stable order', () => {
    expect(sortVersionsNewestFirst(['1.0', '1.0.0', '1.0'])).toEqual([
      '1.0.0',
      '1.0',
      '1.0',
    ]);
  });

  it('ignores a leading v when comparing', () => {
    expect(sortVersionsNewestFirst(['v2.1.0', '2.10.0', 'V2.2.0'])).toEqual([
      '2.10.0',
      'V2.2.0',
      'v2.1.0',
    ]);
  });

  it('ranks a release above its own pre-release', () => {
    expect(
      sortVersionsNewestFirst(['1.4.0-beta', '1.4.0', '1.4.0-rc', '1.3.9']),
    ).toEqual(['1.4.0', '1.4.0-rc', '1.4.0-beta', '1.3.9']);
  });

  it('orders numbers inside a suffix as numbers', () => {
    expect(sortVersionsNewestFirst(['2.0b2', '2.0b10', '2.0b9'])).toEqual([
      '2.0b10',
      '2.0b9',
      '2.0b2',
    ]);
  });

  it('compares segments longer than a safe integer exactly', () => {
    expect(
      sortVersionsNewestFirst(['1.20260115123456789', '1.20260115123456788']),
    ).toEqual(['1.20260115123456789', '1.20260115123456788']);
  });

  it('ignores leading zeros inside a segment', () => {
    expect(sortVersionsNewestFirst(['2026.01.09', '2026.01.10'])).toEqual([
      '2026.01.10',
      '2026.01.09',
    ]);
  });

  it('places text without a number after every numbered version', () => {
    expect(
      sortVersionsNewestFirst(['Varies with device', '1.0.0', '', '12.0.0']),
    ).toEqual(['12.0.0', '1.0.0', 'Varies with device', '']);
  });

  it('does not mistake a word that starts with v for a version', () => {
    expect(compareVersions('vendor build', '0.0.1')).toBeLessThan(0);
  });

  it('does not change the list it was given', () => {
    const versions = ['1.0.0', '2.0.0'];

    sortVersionsNewestFirst(versions);

    expect(versions).toEqual(['1.0.0', '2.0.0']);
  });

  it('returns an empty list for no versions', () => {
    expect(sortVersionsNewestFirst([])).toEqual([]);
  });
});

describe('compareVersions', () => {
  it('is zero only for the same text', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.0', '1.0.0')).not.toBe(0);
    expect(compareVersions('1.0', '1.00')).not.toBe(0);
    expect(compareVersions('01', '1')).not.toBe(0);
  });

  it('orders versions the collator calls equal the same way whatever the input order', () => {
    expect(sortVersionsNewestFirst(['1.0', '1.00'])).toEqual(
      sortVersionsNewestFirst(['1.00', '1.0']),
    );
  });

  it('is antisymmetric', () => {
    expect(compareVersions('2.0.0', '10.0.0')).toBeLessThan(0);
    expect(compareVersions('10.0.0', '2.0.0')).toBeGreaterThan(0);
  });
});
