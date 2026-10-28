import type { Store } from '../index';
import type { RankMilestoneDirection, RankMilestoneTier } from '../rank';
import type { AlertAppIdentity } from './changes';
import { OVERALL_GENRE, type CategoryCollection } from './category-ranks';

export const CHART_DEVICES = ['iphone', 'android'] as const;
export type ChartDevice = (typeof CHART_DEVICES)[number];

const DEVICES_OF: Record<Store, readonly ChartDevice[]> = {
  APP_STORE: ['iphone'],
  GOOGLE_PLAY: ['android'],
};

export function chartDevicesOf(store: Store): readonly ChartDevice[] {
  return DEVICES_OF[store];
}

export function defaultChartDevice(store: Store): ChartDevice {
  return DEVICES_OF[store][0];
}

export const CHART_DEPTH: Record<Store, number> = {
  APP_STORE: 100,
  GOOGLE_PLAY: 200,
};

export const CHART_COMPARE_WINDOWS = ['1d', '7d', '30d'] as const;
export type ChartCompareWindow = (typeof CHART_COMPARE_WINDOWS)[number];

const COMPARE_DAYS: Record<ChartCompareWindow, number> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
};

export function compareDays(window: ChartCompareWindow): number {
  return COMPARE_DAYS[window];
}

export const CHART_TRENDING_LIMIT = 10;

export type ChartGenreGroup = 'apps' | 'games' | 'family';

export interface ChartGenre {
  id: string;
  name: string;
  group: ChartGenreGroup;
}

function group(
  groupName: ChartGenreGroup,
  rows: readonly (readonly [string, string])[],
): ChartGenre[] {
  return rows.map(([id, name]) => ({ id, name, group: groupName }));
}

export const APP_STORE_CHART_GENRES: readonly ChartGenre[] = [
  ...group('apps', [
    ['6000', 'Business'],
    ['6001', 'Weather'],
    ['6002', 'Utilities'],
    ['6003', 'Travel'],
    ['6004', 'Sports'],
    ['6005', 'Social Networking'],
    ['6006', 'Reference'],
    ['6007', 'Productivity'],
    ['6008', 'Photo & Video'],
    ['6009', 'News'],
    ['6010', 'Navigation'],
    ['6011', 'Music'],
    ['6012', 'Lifestyle'],
    ['6013', 'Health & Fitness'],
    ['6014', 'Games'],
    ['6015', 'Finance'],
    ['6016', 'Entertainment'],
    ['6017', 'Education'],
    ['6018', 'Books'],
    ['6020', 'Medical'],
    ['6021', 'Magazines & Newspapers'],
    ['6023', 'Food & Drink'],
    ['6024', 'Shopping'],
    ['6026', 'Developer Tools'],
    ['6027', 'Graphics & Design'],
  ]),
  ...group('games', [
    ['7001', 'Action'],
    ['7002', 'Adventure'],
    ['7003', 'Casual'],
    ['7004', 'Board'],
    ['7005', 'Card'],
    ['7006', 'Casino'],
    ['7009', 'Family'],
    ['7011', 'Music'],
    ['7012', 'Puzzle'],
    ['7013', 'Racing'],
    ['7014', 'Role Playing'],
    ['7015', 'Simulation'],
    ['7016', 'Sports'],
    ['7017', 'Strategy'],
    ['7018', 'Trivia'],
    ['7019', 'Word'],
  ]),
];

export const GOOGLE_PLAY_CHART_CATEGORIES: readonly ChartGenre[] = [
  ...group('apps', [
    ['ANDROID_WEAR', 'Wear OS'],
    ['ART_AND_DESIGN', 'Art & Design'],
    ['AUTO_AND_VEHICLES', 'Auto & Vehicles'],
    ['BEAUTY', 'Beauty'],
    ['BOOKS_AND_REFERENCE', 'Books & Reference'],
    ['BUSINESS', 'Business'],
    ['COMICS', 'Comics'],
    ['COMMUNICATION', 'Communication'],
    ['DATING', 'Dating'],
    ['EDUCATION', 'Education'],
    ['ENTERTAINMENT', 'Entertainment'],
    ['EVENTS', 'Events'],
    ['FINANCE', 'Finance'],
    ['FOOD_AND_DRINK', 'Food & Drink'],
    ['HEALTH_AND_FITNESS', 'Health & Fitness'],
    ['HOUSE_AND_HOME', 'House & Home'],
    ['LIBRARIES_AND_DEMO', 'Libraries & Demo'],
    ['LIFESTYLE', 'Lifestyle'],
    ['MAPS_AND_NAVIGATION', 'Maps & Navigation'],
    ['MEDICAL', 'Medical'],
    ['MUSIC_AND_AUDIO', 'Music & Audio'],
    ['NEWS_AND_MAGAZINES', 'News & Magazines'],
    ['PARENTING', 'Parenting'],
    ['PERSONALIZATION', 'Personalization'],
    ['PHOTOGRAPHY', 'Photography'],
    ['PRODUCTIVITY', 'Productivity'],
    ['SHOPPING', 'Shopping'],
    ['SOCIAL', 'Social'],
    ['SPORTS', 'Sports'],
    ['TOOLS', 'Tools'],
    ['TRAVEL_AND_LOCAL', 'Travel & Local'],
    ['VIDEO_PLAYERS', 'Video Players & Editors'],
    ['WATCH_FACE', 'Watch Faces'],
    ['WEATHER', 'Weather'],
  ]),
  ...group('games', [
    ['GAME', 'Games'],
    ['GAME_ACTION', 'Action'],
    ['GAME_ADVENTURE', 'Adventure'],
    ['GAME_ARCADE', 'Arcade'],
    ['GAME_BOARD', 'Board'],
    ['GAME_CARD', 'Card'],
    ['GAME_CASINO', 'Casino'],
    ['GAME_CASUAL', 'Casual'],
    ['GAME_EDUCATIONAL', 'Educational'],
    ['GAME_MUSIC', 'Music'],
    ['GAME_PUZZLE', 'Puzzle'],
    ['GAME_RACING', 'Racing'],
    ['GAME_ROLE_PLAYING', 'Role Playing'],
    ['GAME_SIMULATION', 'Simulation'],
    ['GAME_SPORTS', 'Sports'],
    ['GAME_STRATEGY', 'Strategy'],
    ['GAME_TRIVIA', 'Trivia'],
    ['GAME_WORD', 'Word'],
  ]),
  ...group('family', [['FAMILY', 'Family']]),
];

export const OVERALL_CHART_GENRE: ChartGenre = {
  id: OVERALL_GENRE,
  name: 'Overall',
  group: 'apps',
};

const GENRES_OF: Record<Store, readonly ChartGenre[]> = {
  APP_STORE: [OVERALL_CHART_GENRE, ...APP_STORE_CHART_GENRES],
  GOOGLE_PLAY: [OVERALL_CHART_GENRE, ...GOOGLE_PLAY_CHART_CATEGORIES],
};

const NAMES_OF: Record<Store, ReadonlyMap<string, string>> = {
  APP_STORE: new Map(
    GENRES_OF.APP_STORE.map((genre) => [genre.id, genre.name]),
  ),
  GOOGLE_PLAY: new Map(
    GENRES_OF.GOOGLE_PLAY.map((genre) => [genre.id, genre.name]),
  ),
};

export function chartGenresOf(store: Store): readonly ChartGenre[] {
  return GENRES_OF[store];
}

export function isChartGenre(store: Store, genre: string): boolean {
  return NAMES_OF[store].has(genre);
}

export function chartGenreName(store: Store, genre: string): string | null {
  return NAMES_OF[store].get(genre) ?? null;
}

export interface ChartKey {
  store: Store;
  country: string;
  collection: CategoryCollection;
  genre: string;
  device: ChartDevice;
}

export const CHARTS_PATH = '/charts';

export const CHART_COLLECTION_TITLES: Record<CategoryCollection, string> = {
  free: 'Top free',
  paid: 'Top paid',
  grossing: 'Top grossing',
};

export type ChartCategoryKey = Omit<ChartKey, 'collection'>;

export interface ChartTableOptions {
  compare?: ChartCompareWindow | null;
  date?: string | null;
}

function categoryParams(category: ChartCategoryKey): URLSearchParams {
  return new URLSearchParams({
    store: category.store,
    country: category.country,
    genre: category.genre,
    device: category.device,
  });
}

export function chartColumnsPath(category: ChartCategoryKey): string {
  return `${CHARTS_PATH}?${categoryParams(category).toString()}`;
}

export function chartTablePath(
  key: ChartKey,
  { compare, date }: ChartTableOptions = {},
): string {
  const params = categoryParams(key);
  params.set('view', 'table');
  params.set('collection', key.collection);
  if (compare && compare !== '1d') params.set('compare', compare);
  if (date) params.set('date', date);
  return `${CHARTS_PATH}?${params.toString()}`;
}

export type ChartMovement = 'up' | 'down' | 'same' | 'new' | 'none';

export interface ChartEntryItem {
  position: number;
  storeAppId: string;
  title: string;
  developer: string | null;
  iconUrl: string | null;
  genreId: string | null;
  genreName: string | null;
  free: boolean | null;
  previous: number | null;
  delta: number | null;
  movement: ChartMovement;
}

export interface ChartMover {
  storeAppId: string;
  title: string;
  developer: string | null;
  iconUrl: string | null;
  position: number | null;
  previous: number | null;
  delta: number | null;
}

export interface ChartTrending {
  climbers: ChartMover[];
  fallers: ChartMover[];
  entries: ChartMover[];
  exits: ChartMover[];
}

export interface ChartCaptureSummary {
  date: string;
  depth: number;
  capturedAt: string;
}

export type ChartAppRole = 'own' | 'competitor';

export interface ChartAppLink {
  storeAppId: string;
  appId: string;
  primaryAppId: string | null;
  name: string | null;
  role: ChartAppRole;
}

export interface ChartFollowItem extends ChartKey {
  id: string;
  genreName: string;
  createdAt: string;
}

export interface ChartPage {
  chart: ChartKey & { genreName: string };
  capture: ChartCaptureSummary | null;
  comparison: ChartCaptureSummary | null;
  compare: ChartCompareWindow;
  entries: ChartEntryItem[];
  trending: ChartTrending;
  dates: string[];
  today: string;
  followed: ChartFollowItem | null;
  apps: ChartAppLink[];
  answeredNoApps?: boolean;
}

export type ChartCaptureRequest = ChartKey;
export type ChartFollowRequest = ChartKey;

export interface ChartMoveScope {
  store: Store;
  country: string;
  collection: CategoryCollection;
  genre: string;
  genreName: string;
  device: ChartDevice;
}

export interface ChartMoveBase {
  occurredAt: string;
  app: { id: string; name: string | null } & AlertAppIdentity;
  chart: ChartMoveScope;
  date: string;
  depth: number;
}

export interface ChartEnteredPayload extends ChartMoveBase {
  event: 'chart.entered';
  from: null;
  to: number;
}

export interface ChartLeftPayload extends ChartMoveBase {
  event: 'chart.left';
  from: number;
  to: null;
}

export interface ChartMilestonePayload extends ChartMoveBase {
  event: 'chart.milestone';
  tier: RankMilestoneTier;
  direction: RankMilestoneDirection;
  from: number | null;
  to: number | null;
}

export type ChartMovePayload =
  ChartEnteredPayload | ChartLeftPayload | ChartMilestonePayload;

export const CHART_MOVE_EVENTS = [
  'chart.entered',
  'chart.left',
  'chart.milestone',
] as const;

export function isChartMovePayload(payload: {
  event: string;
}): payload is ChartMovePayload {
  return CHART_MOVE_EVENTS.some((event) => event === payload.event);
}
