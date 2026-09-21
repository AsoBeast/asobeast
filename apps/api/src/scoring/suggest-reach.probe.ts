import { searchKey } from '@asobeast/shared';
import { PREFIX_PROBE_CAP, SuggestReach } from './suggest-reach';

export type SuggestLookup = (term: string) => Promise<Array<{ term: string }>>;

export interface ProbedReach {
  reach: SuggestReach;
  requests: number;
}

const positionIn = (list: Array<{ term: string }>, target: string): number =>
  list.findIndex((item) => searchKey(item.term) === target) + 1;

export async function probeSuggestReach(
  keyword: string,
  lookup: SuggestLookup,
): Promise<ProbedReach> {
  const target = searchKey(keyword);
  let requests = 0;
  const ask = (term: string) => {
    requests += 1;
    return lookup(term);
  };

  try {
    const fullPosition = positionIn(await ask(keyword), target);
    if (fullPosition === 0) {
      return { reach: { status: 'absent' }, requests };
    }
    const lastPrefix = Math.min(keyword.length, PREFIX_PROBE_CAP);
    for (let length = 1; length <= lastPrefix; length += 1) {
      const position =
        length === keyword.length
          ? fullPosition
          : positionIn(await ask(keyword.slice(0, length)), target);
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
