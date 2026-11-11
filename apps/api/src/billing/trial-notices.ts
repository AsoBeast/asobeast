const HOUR_MS = 60 * 60 * 1000;

const DAY_MS = 24 * HOUR_MS;

export const CHARGE_REMINDER = 5;

export const TRIAL_ENDED_NOTICE = 8;

export const TRIAL_NOTICE_DAYS = [
  0,
  3,
  CHARGE_REMINDER,
  TRIAL_ENDED_NOTICE,
] as const;

export type TrialNoticeDay = (typeof TRIAL_NOTICE_DAYS)[number];

const PROMISED_REMINDER_HOURS = 72;

const HOURLY_SWEEP_MARGIN_HOURS = 2;

const CHARGE_REMINDER_LEAD_MS =
  (PROMISED_REMINDER_HOURS + HOURLY_SWEEP_MARGIN_HOURS) * HOUR_MS;

export interface TrialProgress {
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  trialNoticeDay: number | null;
}

export function timeLeftLabel(endsAt: Date, now: Date): string {
  const hours = Math.floor((endsAt.getTime() - now.getTime()) / HOUR_MS);
  if (hours < 1) return 'less than an hour';
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

function isDue(
  day: TrialNoticeDay,
  startedAt: Date,
  endsAt: Date | null,
  now: Date,
): boolean {
  const at = now.getTime();
  if (day === CHARGE_REMINDER) {
    return (
      endsAt !== null &&
      endsAt.getTime() - startedAt.getTime() > CHARGE_REMINDER_LEAD_MS &&
      at >= endsAt.getTime() - CHARGE_REMINDER_LEAD_MS
    );
  }
  if (day === TRIAL_ENDED_NOTICE) {
    return endsAt !== null && at >= endsAt.getTime();
  }
  return at >= startedAt.getTime() + day * DAY_MS;
}

export function dueTrialNotice(
  progress: TrialProgress,
  now: Date,
): TrialNoticeDay | null {
  const { trialStartedAt, trialEndsAt, trialNoticeDay } = progress;
  if (!trialStartedAt || now < trialStartedAt) return null;

  const sent = trialNoticeDay ?? -1;
  const due = TRIAL_NOTICE_DAYS.filter(
    (day) => day > sent && isDue(day, trialStartedAt, trialEndsAt, now),
  );
  return due.at(-1) ?? null;
}
