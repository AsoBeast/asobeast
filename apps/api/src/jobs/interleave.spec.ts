import { interleave } from './interleave';

describe('interleave', () => {
  it('gives every workspace a slice per cycle', () => {
    expect(
      interleave([
        ['a1', 'a2', 'a3'],
        ['b1', 'b2', 'b3'],
      ]),
    ).toEqual(['a1', 'b1', 'a2', 'b2', 'a3', 'b3']);
  });

  it('keeps enqueueing the large workspace once the small one is done', () => {
    expect(interleave([['a1', 'a2', 'a3'], ['b1']])).toEqual([
      'a1',
      'b1',
      'a2',
      'a3',
    ]);
  });

  it('loses nothing it was given', () => {
    const batches = [['a1', 'a2'], ['b1', 'b2', 'b3'], ['c1']];

    expect(interleave(batches).sort()).toEqual(batches.flat().sort());
  });

  it('ignores a workspace with nothing to do', () => {
    expect(interleave([[], ['b1', 'b2'], []])).toEqual(['b1', 'b2']);
  });

  it('returns nothing for no workspaces', () => {
    expect(interleave([])).toEqual([]);
  });

  it('preserves each workspace order inside its own slice', () => {
    const ordered = interleave([
      ['a1', 'a2', 'a3'],
      ['b1', 'b2'],
    ]);

    expect(ordered.filter((job) => job.startsWith('a'))).toEqual([
      'a1',
      'a2',
      'a3',
    ]);
  });
});
