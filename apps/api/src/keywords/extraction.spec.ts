import { extractCandidates } from './extraction';

describe('extractCandidates', () => {
  it('extracts weighted ngrams from a game title with subtitle', () => {
    expect(
      extractCandidates({
        title: 'Zombie Castle Defense',
        subtitle: 'Tower strategy game',
      }),
    ).toEqual([
      { text: 'zombie castle defense', source: 'TITLE', weight: 3 },
      { text: 'zombie castle', source: 'TITLE', weight: 3 },
      { text: 'castle defense', source: 'TITLE', weight: 3 },
      { text: 'zombie', source: 'TITLE', weight: 3 },
      { text: 'castle', source: 'TITLE', weight: 3 },
      { text: 'defense', source: 'TITLE', weight: 3 },
      { text: 'tower strategy game', source: 'SUBTITLE', weight: 2 },
      { text: 'tower strategy', source: 'SUBTITLE', weight: 2 },
      { text: 'strategy game', source: 'SUBTITLE', weight: 2 },
      { text: 'tower', source: 'SUBTITLE', weight: 2 },
      { text: 'strategy', source: 'SUBTITLE', weight: 2 },
      { text: 'game', source: 'SUBTITLE', weight: 2 },
    ]);
  });

  it('does not build ngrams across separators for a utility app', () => {
    expect(
      extractCandidates({ title: 'PDF Scanner & Document Reader' }),
    ).toEqual([
      { text: 'pdf scanner', source: 'TITLE', weight: 3 },
      { text: 'document reader', source: 'TITLE', weight: 3 },
      { text: 'pdf', source: 'TITLE', weight: 3 },
      { text: 'scanner', source: 'TITLE', weight: 3 },
      { text: 'document', source: 'TITLE', weight: 3 },
      { text: 'reader', source: 'TITLE', weight: 3 },
    ]);
  });

  it('handles a one word brand title', () => {
    expect(extractCandidates({ title: 'Spotify' })).toEqual([
      { text: 'spotify', source: 'TITLE', weight: 3 },
    ]);
  });

  it('keeps the highest weight source when a term repeats', () => {
    expect(
      extractCandidates({ title: 'Streak', subtitle: 'streak counter' }),
    ).toEqual([
      { text: 'streak', source: 'TITLE', weight: 3 },
      { text: 'streak counter', source: 'SUBTITLE', weight: 2 },
      { text: 'counter', source: 'SUBTITLE', weight: 2 },
    ]);
  });

  it('maps summary candidates to the DESCRIPTION source', () => {
    expect(
      extractCandidates({ title: 'Notes', summary: 'markdown editor' }),
    ).toEqual([
      { text: 'notes', source: 'TITLE', weight: 3 },
      { text: 'markdown editor', source: 'DESCRIPTION', weight: 1 },
      { text: 'markdown', source: 'DESCRIPTION', weight: 1 },
      { text: 'editor', source: 'DESCRIPTION', weight: 1 },
    ]);
  });
});
