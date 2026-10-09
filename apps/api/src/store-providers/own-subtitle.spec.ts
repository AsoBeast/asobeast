import { Store } from '@prisma/client';
import { ownSubtitle } from './own-subtitle';

const GAME = { genres: ['Games', 'Action', 'Casual'] };

describe('ownSubtitle', () => {
  it.each([
    ['the primary category', 'Games'],
    ['the subgenre a game page prints in its place', 'Action'],
    ['the last genre of the listing', 'Casual'],
  ])('reads %s as no subtitle', (_, subtitle) => {
    expect(ownSubtitle(Store.APP_STORE, { subtitle, raw: GAME })).toBeNull();
  });

  it.each([
    ['a real subtitle', 'A game about survival'],
    ['a subtitle that only contains a genre word', 'Action Puzzle Games'],
    ['a genre of another listing', 'Puzzle'],
    ['a genre in another case', 'action'],
  ])('keeps %s', (_, subtitle) => {
    expect(ownSubtitle(Store.APP_STORE, { subtitle, raw: GAME })).toBe(
      subtitle,
    );
  });

  it('returns no subtitle for a listing without one', () => {
    expect(
      ownSubtitle(Store.APP_STORE, { subtitle: null, raw: GAME }),
    ).toBeNull();
    expect(ownSubtitle(Store.APP_STORE, { raw: GAME })).toBeNull();
  });

  it('keeps the subtitle of a listing whose payload has no genres', () => {
    expect(ownSubtitle(Store.APP_STORE, { subtitle: 'Action', raw: {} })).toBe(
      'Action',
    );
    expect(
      ownSubtitle(Store.APP_STORE, { subtitle: 'Action', raw: null }),
    ).toBe('Action');
  });
});
