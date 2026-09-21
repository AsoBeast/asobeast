import { searchKey, Store } from '@asobeast/shared';
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

export const PLURAL_ENDINGS = ['', 's', 'es'] as const;

const extendsKeyword = (term: string, target: string): boolean =>
  PLURAL_ENDINGS.some(
    (ending) =>
      term === `${target}${ending}` || term.startsWith(`${target}${ending} `),
  );

const matches = (term: string, target: string, match: SuggestMatch) =>
  match === 'exact' ? term === target : extendsKeyword(term, target);

const positionIn = (
  list: Array<{ term: string }>,
  target: string,
  match: SuggestMatch,
): number =>
  list.findIndex((item) => matches(searchKey(item.term), target, match)) + 1;

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
    const lastPrefix = Math.min(keyword.length, PREFIX_PROBE_CAP);
    for (let length = 1; length <= lastPrefix; length += 1) {
      const position =
        length === keyword.length
          ? fullPosition
          : positionIn(await ask(keyword.slice(0, length)), target, match);
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
