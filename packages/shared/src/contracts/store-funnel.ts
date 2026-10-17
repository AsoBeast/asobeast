import type { Store } from '../index';
import {
  CHANGE_IMPACT_WINDOWS,
  type ChangeImpactStatus,
  type ChangeImpactWindowDays,
} from './change-impact';

export const STORE_FUNNEL_WINDOWS = CHANGE_IMPACT_WINDOWS;
export type StoreFunnelWindowDays = ChangeImpactWindowDays;

export const STORE_FUNNEL_SOURCES = [
  'search',
  'browse',
  'referrer',
  'other',
  'all',
] as const;
export type StoreFunnelSource = (typeof STORE_FUNNEL_SOURCES)[number];

export const STORE_FUNNEL_PAGE_TYPES = [
  'productPage',
  'noPage',
  'inAppEvent',
  'storeSheet',
  'other',
] as const;
export type StoreFunnelPageType = (typeof STORE_FUNNEL_PAGE_TYPES)[number];

export const STORE_FUNNEL_SOURCE_KINDS = [
  'appStoreConnect',
  'playConsole',
] as const;
export type StoreFunnelSourceKind = (typeof STORE_FUNNEL_SOURCE_KINDS)[number];

export const STORE_FUNNEL_COMPLETE_AFTER_DAYS = 3;
export const STORE_FUNNEL_MAX_DAYS = 365;
export const STORE_FUNNEL_DEFAULT_DAYS = 90;

export interface StoreFunnelCounts {
  impressions: number | null;
  uniqueImpressions: number | null;
  pageViews: number;
  gets: number;
  conversion: number | null;
}

export interface StoreFunnelChange {
  impressions: number | null;
  pageViews: number | null;
  gets: number | null;
  conversion: number | null;
}

export interface StoreFunnelPoint {
  date: string;
  complete: boolean;
  total: StoreFunnelCounts;
  search: StoreFunnelCounts;
}

export interface StoreFunnelWindow {
  days: StoreFunnelWindowDays;
  status: ChangeImpactStatus;
  from: string;
  to: string;
  current: StoreFunnelCounts | null;
  previous: StoreFunnelCounts | null;
  change: StoreFunnelChange | null;
}

export interface StoreFunnelReport {
  appId: string;
  store: Store;
  country: string | null;
  connected: boolean;
  source: StoreFunnelSourceKind | null;
  days: number;
  completeThrough: string | null;
  points: StoreFunnelPoint[];
  windows: StoreFunnelWindow[];
}

const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export function funnelConversion(
  gets: number,
  denominator: number | null,
): number | null {
  if (denominator === null || denominator === 0) return null;
  return round(gets / denominator, 4);
}

export function funnelChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return round((current - previous) / previous, 3);
}
