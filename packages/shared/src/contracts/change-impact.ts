import type { ChangeField } from './changes';
import type { StoreFunnelChange, StoreFunnelCounts } from './store-funnel';

export const CHANGE_IMPACT_WINDOWS = [7, 14, 28] as const;
export type ChangeImpactWindowDays = (typeof CHANGE_IMPACT_WINDOWS)[number];

export type ChangeImpactStatus = 'measured' | 'pending' | 'unmeasured';

export interface ChangeImpactMovement {
  improved: number;
  declined: number;
  unchanged: number;
  entered: number;
  exited: number;
  measured: number;
}

export interface ChangeImpactFunnel {
  status: ChangeImpactStatus;
  completeDays: number;
  before: StoreFunnelCounts | null;
  after: StoreFunnelCounts | null;
  change: StoreFunnelChange | null;
  finalOn?: string;
}

export interface ChangeImpactWindow {
  days: ChangeImpactWindowDays;
  status: ChangeImpactStatus;
  targetDate: string;
  measuredOn: string | null;
  movement: ChangeImpactMovement | null;
  medianPositionChange: number | null;
  visibilityBefore: number | null;
  visibilityAfter: number | null;
  visibilityChange: number | null;
  overlappingChanges: string[];
  funnel?: ChangeImpactFunnel | null;
}

export interface ChangeImpactItem {
  changedOn: string;
  fields: ChangeField[];
  baselineDate: string | null;
  windows: ChangeImpactWindow[];
}

export interface ChangeImpactReport {
  appId: string;
  country: string;
  days: number;
  totalChanges: number;
  items: ChangeImpactItem[];
}
