import {
  brandTopTen,
  headTopTen,
  junkTopTen,
  tailTopTen,
} from './scoring-fixtures';
import { paddingFactor, serpRelevance, titleEvidence } from './serp-signals';

describe('titleEvidence', () => {
  it.each([
    ['Geo Quiz World', 'geo quiz', 1],
    ['Quiz about Geo', 'geo quiz', 0.7],
    ['Quiz Master', 'geo quiz', 0.2],
    ['Weather', 'geo quiz', 0],
    ['Anything', '', 0],
    ['geo quiz', 'Géo  Quiz', 1],
    ['GEO QUIZ!', 'geo quiz', 1],
  ])('%s against %s is %s', (title, keyword, expected) => {
    expect(titleEvidence(title, keyword)).toBeCloseTo(expected, 6);
  });
});

describe('serpRelevance and paddingFactor', () => {
  it.each([
    {
      name: 'head',
      topTen: headTopTen(),
      keyword: 'quiz',
      relevance: 1,
      padding: 1,
    },
    {
      name: 'brand',
      topTen: brandTopTen(),
      keyword: 'geoguessr',
      relevance: 0.1,
      padding: 0.25,
    },
    {
      name: 'junk',
      topTen: junkTopTen(),
      keyword: 'videos put',
      relevance: 0,
      padding: 0.25,
    },
    {
      name: 'tail',
      topTen: tailTopTen(),
      keyword: 'guess the location',
      relevance: 0.4,
      padding: 1,
    },
    {
      name: 'empty page',
      topTen: [],
      keyword: 'quiz',
      relevance: 0,
      padding: 0.25,
    },
  ])('$name', ({ topTen, keyword, relevance, padding }) => {
    expect(serpRelevance(topTen, keyword)).toBeCloseTo(relevance, 6);
    expect(paddingFactor(topTen, keyword)).toBeCloseTo(padding, 6);
  });
});
