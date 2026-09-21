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
    ['Product Roadmap Planner', 'map', 0],
    ['Geography Quiz', 'geo', 0],
    ['Carpet cleaning', 'car pet', 0],
    ['Google Maps', 'map', 1],
    ['Map Quiz', 'maps', 1],
    ['Flags of the World Quiz', 'flag quiz', 0.7],
    ['Boxes and Foxes', 'box', 1],
    ['Mapes Hotel', 'map', 0],
    ['Trivia Quizzes', 'quiz', 1],
    ['Countries of the World', 'country', 1],
    ['墨迹天气预报', '天气', 1],
    ['地図ゲーム 世界', '地図 ゲーム', 0.7],
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
