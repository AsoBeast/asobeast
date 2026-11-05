import { commaList } from './comma-list';

describe('commaList', () => {
  it.each([
    ['OPEN,SNOOZED', ['OPEN', 'SNOOZED']],
    [' OPEN , ,SNOOZED ', ['OPEN', 'SNOOZED']],
    ['', []],
  ])('splits %j into its trimmed entries', (value, expected) => {
    expect(commaList({ value })).toEqual(expected);
  });

  it('leaves an array untouched', () => {
    const value = ['OPEN'];
    expect(commaList({ value })).toBe(value);
  });

  it.each([undefined, 7])('passes %j through', (value) => {
    expect(commaList({ value })).toBe(value);
  });
});
