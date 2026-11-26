import {
  countChars,
  isCheckFresh,
  isRanked,
  KEYWORD_MIN_RELEVANCE,
  keywordFieldChars,
  placementFieldsOf,
  PlacementReason,
  PlacementSuggestion,
  PlacementSuggestionField,
  Store,
  STORE_FIELD_LIMITS,
  TARGET_SLOT_ROLES,
  TargetScores,
} from '@asobeast/shared';
import { LONGTAIL_MAX_VOLUME, LONGTAIL_MIN_WORDS } from '../buckets';
import { fitsOwnListing } from '../keyword-class';

export const PLACEMENT_MIN_POPULARITY = 20;
export const PLACEMENT_MIN_RELEVANCE = KEYWORD_MIN_RELEVANCE;
export const TITLE_MIN_POPULARITY = 40;
export const REACHABLE_POSITION = 30;
export const LONG_TAIL_WORDS = LONGTAIL_MIN_WORDS;
export const LONG_TAIL_POPULARITY = LONGTAIL_MAX_VOLUME;
export const SUBTITLE_KEYWORDS = TARGET_SLOT_ROLES.filter(
  (role) => role === 'subtitle',
).length;

export interface PlacementItem {
  text: string;
  lead: TargetScores | null;
}

export interface PlacementInput {
  store: Store;
  targets: readonly PlacementItem[];
  candidates: readonly PlacementItem[];
  today: string;
}

interface KeywordFacts {
  text: string;
  popularity: number;
  reachable: boolean;
}

interface Room {
  title: boolean;
  subtitle: readonly string[];
  field: readonly string[];
  placed: ReadonlySet<string>;
}

interface Placed {
  field: PlacementSuggestionField;
  reason: PlacementReason;
  room: Room;
}

type Figures = Pick<
  PlacementSuggestion,
  'popularity' | 'difficulty' | 'position'
>;

interface Judged {
  keyword: KeywordFacts;
  figures: Figures;
  skip: PlacementReason | null;
}

const EMPTY_ROOM: Room = {
  title: false,
  subtitle: [],
  field: [],
  placed: new Set(),
};

const wordsOf = (text: string): string[] => text.split(' ').filter(Boolean);

const descending = (left: number | null, right: number | null): number =>
  (right ?? -1) - (left ?? -1);

export const byStrength = (
  left: { text: string; lead: TargetScores },
  right: { text: string; lead: TargetScores },
): number =>
  descending(left.lead.opportunity, right.lead.opportunity) ||
  descending(left.lead.popularity, right.lead.popularity) ||
  left.text.localeCompare(right.text);

function skipReason(
  lead: TargetScores,
  popularity: number,
): PlacementReason | null {
  if (!fitsOwnListing(lead.keywordClass)) return 'competitorBrand';
  if (lead.keywordClass === 'ownBrand') return 'ownBrand';
  if (popularity < PLACEMENT_MIN_POPULARITY || lead.floorAnswer) {
    return 'lowPopularity';
  }
  if (lead.relevance !== null && lead.relevance < PLACEMENT_MIN_RELEVANCE) {
    return 'lowRelevance';
  }
  return null;
}

const freshPosition = (lead: TargetScores, today: string): number | null =>
  isRanked(lead.position) &&
  lead.checkedOn !== null &&
  isCheckFresh(lead.checkedOn, today)
    ? lead.position
    : null;

const isReachable = (
  difficulty: number | null,
  popularity: number,
  position: number | null,
): boolean =>
  (difficulty !== null && difficulty < popularity) ||
  (position !== null && position <= REACHABLE_POSITION);

function judge(item: PlacementItem, today: string): Judged[] {
  const lead = item.lead;
  if (!lead || lead.popularity === null || lead.scoreOutdated) return [];
  const popularity = lead.popularity;
  const position = freshPosition(lead, today);
  return [
    {
      keyword: {
        text: item.text,
        popularity,
        reachable: isReachable(lead.difficulty, popularity, position),
      },
      figures: { popularity, difficulty: lead.difficulty, position },
      skip: skipReason(lead, popularity),
    },
  ];
}

const limitOf = (store: Store, field: PlacementSuggestionField): number =>
  field === 'skip' ? 0 : (STORE_FIELD_LIMITS[store][field]?.limit ?? 0);

const fitsTogether = (phrases: readonly string[], limit: number): boolean =>
  countChars(phrases.join(' ')) <= limit;

const withPlaced = (placed: ReadonlySet<string>, words: readonly string[]) =>
  new Set([...placed, ...words]);

function leftoverReason({ text, popularity }: KeywordFacts): PlacementReason {
  const words = wordsOf(text).length;
  if (words === 1) return 'singleWord';
  if (words >= LONG_TAIL_WORDS || popularity < LONG_TAIL_POPULARITY) {
    return 'longTail';
  }
  return 'hardToRank';
}

function fieldRoom(
  store: Store,
  field: PlacementSuggestionField,
  room: Room,
  keyword: KeywordFacts,
): Placed {
  const added = [...new Set(wordsOf(keyword.text))].filter(
    (word) => !room.placed.has(word),
  );
  if (keywordFieldChars([...room.field, ...added]) > limitOf(store, field)) {
    return { field: 'skip', reason: 'noRoom', room };
  }
  return {
    field,
    reason: keyword.reachable ? 'noStrongRoom' : leftoverReason(keyword),
    room: {
      ...room,
      field: [...room.field, ...added],
      placed: withPlaced(room.placed, added),
    },
  };
}

function place(store: Store, room: Room, keyword: KeywordFacts): Placed {
  const [title, strong, rest] = placementFieldsOf(store);
  const words = wordsOf(keyword.text);
  if (
    !room.title &&
    keyword.reachable &&
    keyword.popularity >= TITLE_MIN_POPULARITY &&
    countChars(keyword.text) <= limitOf(store, title)
  ) {
    return {
      field: title,
      reason: 'strongestReachable',
      room: { ...room, title: true, placed: withPlaced(room.placed, words) },
    };
  }
  const subtitle = [...room.subtitle, keyword.text];
  if (
    keyword.reachable &&
    subtitle.length <= SUBTITLE_KEYWORDS &&
    fitsTogether(subtitle, limitOf(store, strong))
  ) {
    return {
      field: strong,
      reason: 'nextReachable',
      room: { ...room, subtitle, placed: withPlaced(room.placed, words) },
    };
  }
  return fieldRoom(store, rest, room, keyword);
}

function suggest(
  store: Store,
  room: Room,
  { keyword, figures, skip }: Judged,
): { suggestion: PlacementSuggestion; room: Room } {
  if (skip) {
    return { suggestion: { field: 'skip', reason: skip, ...figures }, room };
  }
  const placed = place(store, room, keyword);
  return {
    suggestion: { field: placed.field, reason: placed.reason, ...figures },
    room: placed.room,
  };
}

const strongestFirst = (items: readonly PlacementItem[]): PlacementItem[] =>
  items
    .flatMap((item) =>
      item.lead ? [{ text: item.text, lead: item.lead }] : [],
    )
    .sort(byStrength);

export function placementVerdicts({
  store,
  targets,
  candidates,
  today,
}: PlacementInput): Map<string, PlacementSuggestion> {
  const verdicts = new Map<string, PlacementSuggestion>();
  const judged = (items: readonly PlacementItem[]) =>
    items.flatMap((item) => judge(item, today));
  let room = EMPTY_ROOM;
  for (const target of judged(strongestFirst(targets))) {
    const next = suggest(store, room, target);
    room = next.room;
    verdicts.set(target.keyword.text, next.suggestion);
  }
  for (const candidate of judged(candidates)) {
    verdicts.set(
      candidate.keyword.text,
      suggest(store, room, candidate).suggestion,
    );
  }
  return verdicts;
}
