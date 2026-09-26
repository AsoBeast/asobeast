import { searchKey, Store } from '@asobeast/shared';
import { pluralsOf } from './plurals';
import { PREFIX_PROBE_CAP, SuggestReach } from './suggest-reach';

export type SuggestLookup = (term: string) => Promise<Array<{ term: string }>>;

export type SuggestMatch = 'exact' | 'prefix';

export const SUGGEST_MATCH: Record<Store, SuggestMatch> = {
  APP_STORE: 'exact',
  GOOGLE_PLAY: 'prefix',
};

export interface ProbedReach {
  reach: SuggestReach;
  requests: number;
}

const extendsKeyword = (term: string, target: string): boolean =>
  pluralsOf(target).some(
    (form) => term === form || term.startsWith(`${form} `),
  );

const matches = (term: string, target: string, match: SuggestMatch) =>
  match === 'exact' || target.includes(' ')
    ? term === target
    : extendsKeyword(term, target);

const positionIn = (
  list: Array<{ term: string }>,
  target: string,
  match: SuggestMatch,
): number =>
  list.findIndex((item) => matches(searchKey(item.term), target, match)) + 1;

export interface CountingLookup {
  ask: SuggestLookup;
  requests: () => number;
}

export function countingLookup(lookup: SuggestLookup): CountingLookup {
  const asked = new Map<string, ReturnType<SuggestLookup>>();
  const ask: SuggestLookup = (term) => {
    const pending = asked.get(term) ?? lookup(term);
    asked.set(term, pending);
    return pending;
  };
  return { ask, requests: () => asked.size };
}

const continues = (term: string, target: string): boolean =>
  term === target || term.startsWith(`${target} `);

export async function countContinuations(
  keyword: string,
  lookup: SuggestLookup,
): Promise<number | null> {
  const target = searchKey(keyword);
  const offered = new Set<string>();
  try {
    for (const typed of [keyword, `${keyword} `]) {
      for (const item of await lookup(typed)) {
        offered.add(searchKey(item.term));
      }
    }
  } catch {
    return null;
  }
  return [...offered].filter((term) => continues(term, target)).length;
}

export async function probeSuggestReach(
  keyword: string,
  lookup: SuggestLookup,
  match: SuggestMatch = 'exact',
): Promise<ProbedReach> {
  const target = searchKey(keyword);
  let requests = 0;
  const ask = (term: string) => {
    requests += 1;
    return lookup(term);
  };

  try {
    const fullPosition = positionIn(await ask(keyword), target, match);
    if (fullPosition === 0) {
      return { reach: { status: 'absent' }, requests };
    }
    const characters = Array.from(keyword);
    const lastPrefix = Math.min(characters.length - 1, PREFIX_PROBE_CAP);
    for (let length = 1; length <= lastPrefix; length += 1) {
      const prefix = characters.slice(0, length).join('');
      const position = positionIn(await ask(prefix), target, match);
      if (position > 0) {
        return {
          reach: { status: 'hit', prefixLength: length, position },
          requests,
        };
      }
    }
    return { reach: { status: 'listed', position: fullPosition }, requests };
  } catch {
    return { reach: { status: 'unavailable' }, requests };
  }
}
