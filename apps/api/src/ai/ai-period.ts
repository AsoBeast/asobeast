const SECOND_MS = 1_000;

export interface AiPeriod {
  start: Date;
  resetsAt: Date;
}

export function aiPeriodOf(now: Date): AiPeriod {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1)),
    resetsAt: new Date(Date.UTC(year, month + 1, 1)),
  };
}

export function secondsUntil(moment: Date, now: Date): number {
  return Math.max(1, Math.ceil((moment.getTime() - now.getTime()) / SECOND_MS));
}

export function aiCallCutoff(retentionCutoff: Date, now: Date): Date {
  const periodStart = aiPeriodOf(now).start;
  return retentionCutoff < periodStart ? retentionCutoff : periodStart;
}
