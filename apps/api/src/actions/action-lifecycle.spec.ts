import { ACTION_STATUSES, ActionStatus } from '@asobeast/shared';
import {
  ACTION_REOPEN_AFTER_DAYS,
  ExistingAction,
  LifecycleOutcome,
  nextLifecycle,
} from './action-lifecycle';

const NOW = new Date('2026-07-30T03:00:00.000Z');
const DAY_MS = 86_400_000;

const daysBefore = (days: number): Date =>
  new Date(NOW.getTime() - days * DAY_MS);

const existing = (
  status: ActionStatus,
  overrides: Partial<ExistingAction> = {},
): ExistingAction => ({
  status,
  lastSeenAt: daysBefore(1),
  closedAt: null,
  verifiedAt: null,
  snoozedUntil: status === 'SNOOZED' ? new Date(NOW.getTime() + DAY_MS) : null,
  reopenCount: 0,
  ...overrides,
});

describe('nextLifecycle', () => {
  it('creates on a first detection and does nothing without one', () => {
    expect(nextLifecycle(null, true, NOW)).toEqual({ kind: 'create' });
    expect(nextLifecycle(null, false, NOW)).toEqual({ kind: 'noop' });
  });

  it('covers every status and fired combination without a default branch', () => {
    const table: Array<[ActionStatus, boolean, LifecycleOutcome]> = [
      ['OPEN', true, { kind: 'refresh', status: 'OPEN' }],
      ['OPEN', false, { kind: 'resolve' }],
      ['SNOOZED', true, { kind: 'refresh', status: 'SNOOZED' }],
      ['SNOOZED', false, { kind: 'resolve' }],
      ['DONE', true, { kind: 'touch' }],
      ['DONE', false, { kind: 'verify' }],
      ['DISMISSED', true, { kind: 'touch' }],
      ['DISMISSED', false, { kind: 'noop' }],
      ['RESOLVED', true, { kind: 'reopen', status: 'OPEN', reopenCount: 1 }],
      ['RESOLVED', false, { kind: 'noop' }],
    ];

    expect(new Set(table.map(([status]) => status)).size).toBe(
      ACTION_STATUSES.length,
    );
    for (const [status, fired, outcome] of table) {
      expect(nextLifecycle(existing(status), fired, NOW)).toEqual(outcome);
    }
  });

  describe('snooze expiry', () => {
    it('stays snoozed strictly before the wake instant', () => {
      const row = existing('SNOOZED', {
        snoozedUntil: new Date(NOW.getTime() + 1),
      });

      expect(nextLifecycle(row, true, NOW)).toEqual({
        kind: 'refresh',
        status: 'SNOOZED',
      });
    });

    it('wakes exactly at the wake instant', () => {
      const row = existing('SNOOZED', { snoozedUntil: new Date(NOW) });

      expect(nextLifecycle(row, true, NOW)).toEqual({
        kind: 'refresh',
        status: 'OPEN',
      });
    });

    it('wakes after the wake instant', () => {
      const row = existing('SNOOZED', {
        snoozedUntil: new Date(NOW.getTime() - 1),
      });

      expect(nextLifecycle(row, true, NOW)).toEqual({
        kind: 'refresh',
        status: 'OPEN',
      });
    });

    it('wakes a snoozed row that lost its wake date', () => {
      const row = existing('SNOOZED', { snoozedUntil: null });

      expect(nextLifecycle(row, true, NOW)).toEqual({
        kind: 'refresh',
        status: 'OPEN',
      });
    });

    it('resolves a still-snoozed row whose rule stopped firing', () => {
      expect(nextLifecycle(existing('SNOOZED'), false, NOW)).toEqual({
        kind: 'resolve',
      });
    });
  });

  describe('done reopening', () => {
    it('touches one day before the reopen gap', () => {
      const row = existing('DONE', {
        closedAt: daysBefore(ACTION_REOPEN_AFTER_DAYS - 1),
      });

      expect(nextLifecycle(row, true, NOW)).toEqual({ kind: 'touch' });
    });

    it('reopens exactly at the reopen gap', () => {
      const row = existing('DONE', {
        closedAt: daysBefore(ACTION_REOPEN_AFTER_DAYS),
        reopenCount: 2,
      });

      expect(nextLifecycle(row, true, NOW)).toEqual({
        kind: 'reopen',
        status: 'OPEN',
        reopenCount: 3,
      });
    });

    it('reopens beyond the reopen gap', () => {
      const row = existing('DONE', {
        closedAt: daysBefore(ACTION_REOPEN_AFTER_DAYS + 5),
      });

      expect(nextLifecycle(row, true, NOW)).toEqual({
        kind: 'reopen',
        status: 'OPEN',
        reopenCount: 1,
      });
    });
  });

  describe('done reopening while the rule keeps firing', () => {
    it('reopens a done action closed fourteen days ago that was touched yesterday', () => {
      const row = existing('DONE', {
        lastSeenAt: daysBefore(1),
        closedAt: daysBefore(ACTION_REOPEN_AFTER_DAYS),
      });

      expect(nextLifecycle(row, true, NOW)).toEqual({
        kind: 'reopen',
        status: 'OPEN',
        reopenCount: 1,
      });
    });
  });

  describe('verification', () => {
    it('verifies a done action whose rule stopped firing', () => {
      expect(nextLifecycle(existing('DONE'), false, NOW)).toEqual({
        kind: 'verify',
      });
    });

    it('leaves a verified action alone while its rule stays silent', () => {
      const row = existing('DONE', { verifiedAt: daysBefore(2) });

      expect(nextLifecycle(row, false, NOW)).toEqual({ kind: 'noop' });
    });

    it('reopens a verified action at once when its rule fires again', () => {
      const row = existing('DONE', {
        closedAt: daysBefore(3),
        verifiedAt: daysBefore(1),
        reopenCount: 1,
      });

      expect(nextLifecycle(row, true, NOW)).toEqual({
        kind: 'reopen',
        status: 'OPEN',
        reopenCount: 2,
      });
    });

    it('still touches an unverified done action inside the reopen gap', () => {
      const row = existing('DONE', { closedAt: daysBefore(3) });

      expect(nextLifecycle(row, true, NOW)).toEqual({ kind: 'touch' });
    });
  });

  it('never reopens a dismissed action automatically, however long it keeps firing', () => {
    const row = existing('DISMISSED', {
      lastSeenAt: daysBefore(ACTION_REOPEN_AFTER_DAYS * 10),
    });

    expect(nextLifecycle(row, true, NOW)).toEqual({ kind: 'touch' });
  });
});
