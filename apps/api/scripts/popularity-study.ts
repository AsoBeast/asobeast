/*
 * Fits the App Store popularity model (src/scoring/popularity-model.ts)
 * against Apple's official search popularity.
 *
 * 1. Export one week of the Apple Ads top terms for a country:
 *    psql -At -c "select json_build_object('floors', (select json_object_agg(genre, floor) from (select genre, min(popularity) floor from \"SearchTermPopularity\" where country='us' and week='2026-09-13' group by genre) f), 'terms', (select json_agg(json_build_object('term', term, 'genre', genre, 'popularity', popularity)) from \"SearchTermPopularity\" where country='us' and week='2026-09-13'))" > terms.json
 * 2. pnpm --filter api scoring:popularity-study collect terms.json samples.json
 *    Live store requests, resumable: rerun to continue an interrupted run.
 *    Paths resolve against the directory the command was run from; keep the
 *    files outside the repository, they hold several MB of search results.
 *    Besides a spread of listed terms per genre it collects unlisted terms at
 *    two depths: search suggestions for listed terms (depth 1) and
 *    suggestions for those (depth 2). Apple publishes no value for them, so
 *    the fit places them 10 and 20 below their genre's lowest listed value.
 * 3. pnpm --filter api scoring:popularity-study fit samples.json
 *    Prints holdout metrics and the weights to paste into POPULARITY_WEIGHTS.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { searchKey } from '@asobeast/shared';
import { inferPopularityGenre } from '../src/scoring/apple-genres';
import { spearman } from '../src/scoring/calibration';
import { SerpApp } from '../src/scoring/formulas';
import {
  MODEL_DEPTH,
  POPULARITY_FEATURES,
  PopularityFeatures,
  PopularityWeights,
  popularityFeatures,
  predictPopularity,
} from '../src/scoring/popularity-model';
import { appStoreLib } from '../src/store-providers/app-store.lib';
import { AppStoreProvider } from '../src/store-providers/app-store.provider';

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number, got "${raw}"`);
  }
  return value;
}

const COUNTRY = process.env.STUDY_COUNTRY ?? 'us';
const PER_GENRE = envNumber('STUDY_PER_GENRE', 30);
const SEEDS = envNumber('STUDY_SEEDS', 150);
const ABSENT = envNumber('STUDY_ABSENT', 200);
const DEEP = envNumber('STUDY_DEEP', 200);
const DELAY_MS = envNumber('STUDY_DELAY_MS', 1500);
const HOLDOUT_SHARE = 0.3;
const RIDGE = envNumber('STUDY_RIDGE', 1);
const ABSENT_OFFSET = envNumber('STUDY_ABSENT_OFFSET', 10);
const ABSENT_WEIGHT = envNumber('STUDY_ABSENT_WEIGHT', 1);
const SINGULAR = 1e-12;

// pnpm runs the script from apps/api, so paths resolve against the caller.
const userPath = (path: string): string =>
  resolve(process.env.INIT_CWD ?? process.cwd(), path);

interface ListedTerm {
  term: string;
  genre: string;
  popularity: number;
}

interface TermsFile {
  floors: Record<string, number>;
  terms: ListedTerm[];
}

interface Sample {
  term: string;
  popularity: number | null;
  genre: string | null;
  floor: number;
  depth?: number;
  results: SerpApp[];
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) {
    return items;
  }
  const step = items.length / count;
  return Array.from(
    { length: count },
    (_, index) => items[Math.floor(index * step)],
  );
}

function readTerms(path: string): TermsFile {
  const file = JSON.parse(readFileSync(path, 'utf8')) as Partial<TermsFile>;
  if (!file.terms?.length || !file.floors || !Object.keys(file.floors).length) {
    throw new Error(`${path} has no listed terms or genre floors for the week`);
  }
  const strongest = new Map<string, ListedTerm>();
  for (const term of file.terms) {
    const known = strongest.get(term.term);
    if (!known || term.popularity > known.popularity) {
      strongest.set(term.term, term);
    }
  }
  return { floors: file.floors, terms: [...strongest.values()] };
}

function sampleListed(file: TermsFile): ListedTerm[] {
  const byGenre = new Map<string, ListedTerm[]>();
  for (const term of file.terms) {
    byGenre.set(term.genre, [...(byGenre.get(term.genre) ?? []), term]);
  }
  return [...byGenre.values()].flatMap((terms) =>
    spread(
      [...terms].sort((a, b) => b.popularity - a.popularity),
      PER_GENRE,
    ),
  );
}

class SampleCollector {
  private readonly provider = new AppStoreProvider(appStoreLib);
  private readonly listed: Set<string>;
  private readonly globalFloor: number;
  readonly samples: Sample[];
  private readonly done: Set<string>;

  constructor(
    private readonly file: TermsFile,
    private readonly outPath: string,
  ) {
    this.listed = new Set(file.terms.map((term) => searchKey(term.term)));
    this.globalFloor = Math.min(...Object.values(file.floors));
    this.samples = existsSync(outPath)
      ? (JSON.parse(readFileSync(outPath, 'utf8')) as Sample[])
      : [];
    this.done = new Set(this.samples.map((sample) => sample.term));
  }

  async collectListed(terms: ListedTerm[]): Promise<void> {
    for (const [index, term] of terms.entries()) {
      if (this.done.has(term.term)) continue;
      try {
        const { apps } = await this.search(term.term);
        this.add({
          term: term.term,
          popularity: term.popularity,
          genre: term.genre,
          floor: this.file.floors[term.genre] ?? this.globalFloor,
          results: apps,
        });
        console.log(`listed ${index + 1}/${terms.length} ${term.term}`);
      } catch (error) {
        console.warn(`skip "${term.term}": ${messageOf(error)}`);
      }
    }
  }

  unlistedAt(depth: number): string[] {
    return this.samples
      .filter((s) => s.popularity === null && (s.depth ?? 1) === depth)
      .map((s) => s.term);
  }

  async collectUnlisted(
    seeds: string[],
    depth: number,
    limit: number,
  ): Promise<void> {
    let found = this.unlistedAt(depth).length;
    for (const seed of seeds) {
      if (found >= limit) break;
      for (const term of await this.hints(seed)) {
        if (found >= limit) break;
        if (this.listed.has(term) || this.done.has(term)) continue;
        try {
          const { apps, genre } = await this.search(term);
          this.add({
            term,
            popularity: null,
            genre: genre ?? null,
            floor: (genre && this.file.floors[genre]) || this.globalFloor,
            depth,
            results: apps,
          });
          found += 1;
          console.log(`unlisted depth ${depth} ${found}/${limit} ${term}`);
        } catch (error) {
          console.warn(`skip "${term}": ${messageOf(error)}`);
        }
      }
    }
  }

  private add(sample: Sample): void {
    this.samples.push(sample);
    this.done.add(sample.term);
    writeFileSync(`${this.outPath}.tmp`, JSON.stringify(this.samples, null, 1));
    renameSync(`${this.outPath}.tmp`, this.outPath);
  }

  private async hints(seed: string): Promise<string[]> {
    try {
      await sleep(DELAY_MS);
      const hints = await this.provider.suggest(seed, COUNTRY);
      return hints.map((hint) => searchKey(hint.term)).filter(Boolean);
    } catch (error) {
      console.warn(`no hints for "${seed}": ${messageOf(error)}`);
      return [];
    }
  }

  private async search(term: string): Promise<SearchResults> {
    await sleep(DELAY_MS);
    const results = await this.provider.search(term, COUNTRY, MODEL_DEPTH);
    return {
      apps: results.map((item) => ({
        title: item.title,
        ...(item.developer === undefined ? {} : { developer: item.developer }),
        ...(item.ratingCount === undefined
          ? {}
          : { ratingCount: item.ratingCount }),
      })),
      genre: inferPopularityGenre(results),
    };
  }
}

async function collect(termsPath: string, outPath: string): Promise<void> {
  const file = readTerms(termsPath);
  const collector = new SampleCollector(file, outPath);
  const positives = sampleListed(file);
  await collector.collectListed(positives);
  await collector.collectUnlisted(
    spread(positives, SEEDS).map((term) => term.term),
    1,
    ABSENT,
  );
  await collector.collectUnlisted(collector.unlistedAt(1), 2, DEEP);
  console.log(`saved ${collector.samples.length} samples to ${outPath}`);
}

interface SearchResults {
  apps: SerpApp[];
  genre: string | undefined;
}

interface Row {
  sample: Sample;
  features: PopularityFeatures;
  target: number;
  weight: number;
  holdout: boolean;
}

const isHoldout = (term: string): boolean =>
  createHash('sha1').update(term).digest()[0] / 256 < HOLDOUT_SHARE;

function solve(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index]]);
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < SINGULAR) {
      throw new Error(
        'the features are collinear; add samples or raise STUDY_RIDGE',
      );
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = 0; row < size; row++) {
      if (row === col) continue;
      const factor = a[row][col] / a[col][col];
      for (let k = col; k <= size; k++) a[row][k] -= factor * a[col][k];
    }
  }
  return a.map((row, index) => row[size] / row[index]);
}

function fitWeights(rows: Row[]): PopularityWeights {
  const design = (f: PopularityFeatures): number[] => [
    1,
    ...POPULARITY_FEATURES.map((name) => f[name]),
  ];
  const size = POPULARITY_FEATURES.length + 1;
  const xtx = Array.from({ length: size }, () =>
    new Array<number>(size).fill(0),
  );
  const xty = new Array<number>(size).fill(0);
  for (const row of rows) {
    const x = design(row.features);
    for (let i = 0; i < size; i++) {
      xty[i] += row.weight * x[i] * row.target;
      for (let j = 0; j < size; j++) xtx[i][j] += row.weight * x[i] * x[j];
    }
  }
  for (let i = 1; i < size; i++) xtx[i][i] += RIDGE;
  const beta = solve(xtx, xty);
  const round = (value: number): number => Number(value.toFixed(4));
  return Object.fromEntries([
    ['intercept', round(beta[0])],
    ...POPULARITY_FEATURES.map((name, index) => [name, round(beta[index + 1])]),
  ]) as PopularityWeights;
}

function auc(listed: number[], absent: number[]): number | null {
  if (listed.length === 0 || absent.length === 0) {
    return null;
  }
  let wins = 0;
  for (const a of listed) {
    for (const b of absent) wins += a > b ? 1 : a === b ? 0.5 : 0;
  }
  return wins / (listed.length * absent.length);
}

const fixed = (value: number | null, digits: number): string =>
  value === null || !Number.isFinite(value) ? 'n/a' : value.toFixed(digits);

const mean = (values: number[]): number | null =>
  values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;

function report(label: string, rows: Row[], weights: PopularityWeights): void {
  const listed = rows.filter((row) => row.sample.popularity !== null);
  const absent = rows.filter((row) => row.sample.popularity === null);
  const predict = (row: Row): number =>
    Math.min(100, Math.max(1, predictPopularity(row.features, weights)));
  const capped = (row: Row): number =>
    Math.min(predict(row), row.sample.floor - 1);
  const errors = listed.map((row) => predict(row) - row.target);
  const rankAgreement =
    listed.length < 2
      ? null
      : spearman(
          listed.map(predict),
          listed.map((row) => row.target),
        );
  console.log(
    `${label}: listed ${listed.length}, absent ${absent.length}, ` +
      `spearman ${fixed(rankAgreement, 3)}, ` +
      `MAE ${fixed(mean(errors.map(Math.abs)), 1)}, ` +
      `bias ${fixed(mean(errors), 1)}, ` +
      `listed-vs-absent AUC ${fixed(auc(listed.map(predict), absent.map(predict)), 3)}, ` +
      `absent median (capped) ${absent.length === 0 ? 'n/a' : median(absent.map(capped)).toFixed(0)}`,
  );
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
};

function fit(samplesPath: string): void {
  const samples = JSON.parse(readFileSync(samplesPath, 'utf8')) as Sample[];
  const rows: Row[] = samples.flatMap((sample) => {
    const features = popularityFeatures(sample.results, sample.term);
    if (features === null) return [];
    const listed = sample.popularity !== null;
    return [
      {
        sample,
        features,
        target: listed
          ? (sample.popularity as number)
          : sample.floor - ABSENT_OFFSET * (sample.depth ?? 1),
        weight: listed ? 1 : ABSENT_WEIGHT,
        holdout: isHoldout(sample.term),
      },
    ];
  });
  if (rows.length <= POPULARITY_FEATURES.length + 1) {
    throw new Error(
      `${rows.length} usable samples cannot fit ${POPULARITY_FEATURES.length + 1} weights`,
    );
  }
  const train = rows.filter((row) => !row.holdout);
  const weights = fitWeights(train);
  report('train', train, weights);
  report(
    'holdout',
    rows.filter((row) => row.holdout),
    weights,
  );
  const final = fitWeights(rows);
  report('all (final weights)', rows, final);
  console.log(JSON.stringify(final, null, 2));
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const [command, first, second] = process.argv.slice(2);
  if (command === 'collect' && first && second) {
    await collect(userPath(first), userPath(second));
  } else if (command === 'fit' && first) {
    fit(userPath(first));
  } else {
    console.log(
      'usage: popularity-study collect <terms.json> <samples.json> | fit <samples.json>',
    );
    process.exitCode = 1;
  }
}

void main();
