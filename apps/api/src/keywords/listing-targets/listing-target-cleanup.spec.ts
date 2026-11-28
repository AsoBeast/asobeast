import { slotsAfterUntrack } from './listing-target-cleanup';

const app = { country: 'us', defaultLocalization: null };

describe('slotsAfterUntrack', () => {
  it('empties the slot of a phrase no reader market still tracks', () => {
    expect(
      slotsAfterUntrack(
        ['habit', 'focus'],
        { app, localization: 'en-US' },
        [{ text: 'habit', country: 'us' }],
        [],
      ),
    ).toEqual(['', 'focus']);
  });

  it('keeps the slot while another reader market still tracks the phrase', () => {
    expect(
      slotsAfterUntrack(
        ['habit'],
        { app, localization: 'en-GB' },
        [{ text: 'habit', country: 'au' }],
        [{ text: 'habit', country: 'gb' }],
      ),
    ).toEqual(['habit']);
  });

  it('empties the slot when only a market that does not read it still tracks the phrase', () => {
    expect(
      slotsAfterUntrack(
        ['habit'],
        { app, localization: 'en-GB' },
        [{ text: 'habit', country: 'gb' }],
        [{ text: 'habit', country: 'us' }],
      ),
    ).toEqual([]);
  });

  it('leaves a localization the removed market does not read alone', () => {
    expect(
      slotsAfterUntrack(
        ['habit'],
        { app, localization: 'ja' },
        [{ text: 'habit', country: 'us' }],
        [],
      ),
    ).toEqual(['habit']);
  });

  it('never shifts the slots after it', () => {
    expect(
      slotsAfterUntrack(
        ['a', 'b', 'c'],
        { app, localization: 'en-US' },
        [{ text: 'b', country: 'us' }],
        [],
      ),
    ).toEqual(['a', '', 'c']);
  });

  it('empties the whole list to no slots', () => {
    expect(
      slotsAfterUntrack(
        ['a', '', 'b'],
        { app, localization: 'en-US' },
        [
          { text: 'a', country: 'us' },
          { text: 'b', country: 'us' },
        ],
        [],
      ),
    ).toEqual([]);
  });
});
