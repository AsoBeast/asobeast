import { ActionStatus } from '@asobeast/shared';

export const ACTION_REOPEN_AFTER_DAYS = 14;

const DAY_MS = 86_400_000;

export interface ExistingAction {
  status: ActionStatus;
  lastSeenAt: Date;
  snoozedUntil: Date | null;
  reopenCount: number;
}

export type LifecycleOutcome =
  | { kind: 'create' }
  | { kind: 'refresh'; status: ActionStatus }
  | { kind: 'reopen'; status: 'OPEN'; reopenCount: number }
  | { kind: 'resolve' }
  | { kind: 'touch' }
  | { kind: 'noop' };

function reopenIsDue(existing: ExistingAction, now: Date): boolean {
  const gap = now.getTime() - existing.lastSeenAt.getTime();
  return gap >= ACTION_REOPEN_AFTER_DAYS * DAY_MS;
}

function firedOutcome(existing: ExistingAction, now: Date): LifecycleOutcome {
  switch (existing.status) {
    case 'OPEN':
      return { kind: 'refresh', status: 'OPEN' };
    case 'SNOOZED':
      return existing.snoozedUntil !== null &&
        existing.snoozedUntil.getTime() > now.getTime()
        ? { kind: 'refresh', status: 'SNOOZED' }
        : { kind: 'refresh', status: 'OPEN' };
    case 'DONE':
      return reopenIsDue(existing, now)
        ? {
            kind: 'reopen',
            status: 'OPEN',
            reopenCount: existing.reopenCount + 1,
          }
        : { kind: 'touch' };
    case 'DISMISSED':
      return { kind: 'touch' };
    case 'RESOLVED':
      return {
        kind: 'reopen',
        status: 'OPEN',
        reopenCount: existing.reopenCount + 1,
      };
  }
}

function missedOutcome(existing: ExistingAction): LifecycleOutcome {
  switch (existing.status) {
    case 'OPEN':
    case 'SNOOZED':
      return { kind: 'resolve' };
    case 'DONE':
    case 'DISMISSED':
    case 'RESOLVED':
      return { kind: 'noop' };
  }
}

export function nextLifecycle(
  existing: ExistingAction | null,
  fired: boolean,
  now: Date,
): LifecycleOutcome {
  if (existing === null) {
    return fired ? { kind: 'create' } : { kind: 'noop' };
  }
  return fired ? firedOutcome(existing, now) : missedOutcome(existing);
}
