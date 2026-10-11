import {
  IdeaHint,
  IdeaListing,
  ideaSeeds,
  ideaSources,
  keywordIdeas,
} from './keyword-ideas';

const listing = (over: Partial<IdeaListing> = {}): IdeaListing => ({
  appId: 'rival',
  name: 'Polarsteps',
  title: 'Polarsteps: Travel Tracker',
  subtitle: 'Trip planner and journal',
  ...over,
});

const other = listing({
  appId: 'other',
  name: 'Been',
  title: 'Been: Countries Visited Map',
  subtitle: 'Travel tracker and map',
});

const sources = ideaSources([listing(), other], []);

const hint = (
  term: string,
  position = 1,
  seed = 'travel tracker',
): IdeaHint => ({
  seed,
  position,
  term,
});

const ideasOf = (
  hints: IdeaHint[],
  over: Partial<Parameters<typeof keywordIdeas>[0]> = {},
) =>
  keywordIdeas({
    sources,
    hints,
    popularity: new Map(),
    excluded: new Set(),
    limit: 50,
    ...over,
  });

describe('ideaSeeds', () => {
  it('leads with the phrases most competitors share', () => {
    expect(ideaSeeds(sources)[0]).toBe('travel tracker');
  });

  it('seeds with phrases, never with a single word', () => {
    expect(ideaSeeds(sources)).not.toContain('travel');
    expect(ideaSeeds(sources)).toContain('trip planner');
  });

  it('skips the brand a competitor leads its title with', () => {
    expect(ideaSeeds(sources)).not.toContain('polarsteps');
    expect(ideaSeeds(sources)).not.toContain('polarsteps travel');
  });

  it('stops at the limit', () => {
    expect(ideaSeeds(sources, 2)).toHaveLength(2);
  });
});

describe('keywordIdeas', () => {
  it('turns a search suggestion into an idea and names who covers it', () => {
    expect(ideasOf([hint('Travel Tracker', 3)])).toEqual([
      {
        text: 'travel tracker',
        popularity: null,
        suggestRank: 3,
        seed: 'travel tracker',
        usedBy: [
          { appId: 'rival', name: 'Polarsteps' },
          { appId: 'other', name: 'Been' },
        ],
      },
    ]);
  });

  it('keeps a suggestion that goes beyond the competitor words', () => {
    expect(ideasOf([hint('world travel tracker')])[0]).toMatchObject({
      text: 'world travel tracker',
      usedBy: [],
    });
  });

  it('drops a suggestion that is the name of an app', () => {
    expect(
      ideasOf([
        hint('visited: travel tracker & map'),
        hint('passport stamps – travel map'),
        hint('findpenguins - travel tracker'),
      ]),
    ).toEqual([]);
  });

  it('drops a suggestion you already track', () => {
    expect(
      ideasOf([hint('travel tracker')], {
        excluded: new Set(['travel tracker']),
      }),
    ).toEqual([]);
  });

  it('drops a completion that only shares a prefix with the seed', () => {
    expect(ideasOf([hint('travelocity', 1, 'travel tracker')])).toEqual([]);
    expect(ideasOf([hint('planet fitness', 1, 'trip planner')])).toEqual([]);
  });

  it('drops a suggestion that runs longer than a search phrase', () => {
    expect(ideasOf([hint('free travel tracker apps similar to been')])).toEqual(
      [],
    );
  });

  it('keeps the best position of a suggestion several seeds return', () => {
    const ideas = ideasOf([
      hint('travel tracker map', 4, 'travel tracker'),
      hint('travel tracker map', 2, 'tracker map'),
    ]);

    expect(ideas).toHaveLength(1);
    expect(ideas[0]).toMatchObject({ suggestRank: 2, seed: 'tracker map' });
  });

  it('carries the official popularity and leads with it', () => {
    const ideas = ideasOf(
      [hint('travel tracker', 1), hint('world travel tracker', 5)],
      { popularity: new Map([['world travel tracker', 55]]) },
    );

    expect(ideas.map((idea) => [idea.text, idea.popularity])).toEqual([
      ['world travel tracker', 55],
      ['travel tracker', null],
    ]);
  });

  it('orders unscored ideas by their position in the suggestions', () => {
    expect(
      ideasOf([
        hint('trip planner map', 4, 'trip planner'),
        hint('road trip planner', 2, 'trip planner'),
      ]).map((idea) => idea.text),
    ).toEqual(['road trip planner', 'trip planner map']);
  });

  it('stops at the limit', () => {
    expect(
      ideasOf([hint('travel tracker'), hint('us travel tracker')], {
        limit: 1,
      }),
    ).toHaveLength(1);
  });
});
