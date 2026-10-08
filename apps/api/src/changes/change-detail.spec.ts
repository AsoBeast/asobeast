import { readChangeDetail } from './change-detail';

describe('readChangeDetail', () => {
  it('reads an images detail', () => {
    const detail = {
      kind: 'images',
      before: [{ position: 1, url: 'a' }],
      after: [{ position: 1, url: 'b' }],
      added: [1],
      removed: [1],
      reordered: false,
    };

    expect(readChangeDetail(detail)).toEqual(detail);
  });

  it('reads a captions detail', () => {
    const detail = { kind: 'captions', added: ['x'], removed: [] };

    expect(readChangeDetail(detail)).toEqual(detail);
  });

  it.each([null, undefined, 'text', 7, {}, { kind: 'unknown' }])(
    'reads %j as no detail',
    (value) => {
      expect(readChangeDetail(value)).toBeNull();
    },
  );

  it('refuses a detail whose lists are malformed', () => {
    expect(
      readChangeDetail({ kind: 'captions', added: [1], removed: [] }),
    ).toBeNull();
  });
});
