const DAY_MS = 24 * 60 * 60 * 1000;

export const TRIAL_NOTICE_DAYS = [0, 3, 5, 7, 8] as const;

export type TrialNoticeDay = (typeof TRIAL_NOTICE_DAYS)[number];

export interface TrialProgress {
  trialStartedAt: Date | null;
  trialNoticeDay: number | null;
}

export function trialDay(startedAt: Date, now: Date): number {
  return Math.floor((now.getTime() - startedAt.getTime()) / DAY_MS);
}

export function dueTrialNotice(
  progress: TrialProgress,
  now: Date,
): TrialNoticeDay | null {
  if (!progress.trialStartedAt) return null;

  const elapsed = trialDay(progress.trialStartedAt, now);
  if (elapsed < 0) return null;

  const sent = progress.trialNoticeDay ?? -1;
  const due = TRIAL_NOTICE_DAYS.filter((day) => day <= elapsed && day > sent);
  return due.at(-1) ?? null;
}
