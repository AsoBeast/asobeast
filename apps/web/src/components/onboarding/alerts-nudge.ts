import type { FirstRunStatus } from "@asobeast/shared";
import { rankingsCollecting } from "./first-run-timeline";

export const ALERTS_NUDGE_MIN_CAPTURES = 2;
export const ALERTS_NUDGE_CHANGE_EVENT = "asobeast:alerts-nudge-change";

export type NudgeState = "hidden" | "email" | "webhook";

export interface NudgeInput {
  firstRun: FirstRunStatus | undefined;
  channels: number | undefined;
  emailEnabled: boolean | undefined;
  dismissed: boolean;
}

const historyCaptures = (status: FirstRunStatus): number =>
  status.stages.find((row) => row.stage === "history")?.ready ?? 0;

export function alertsNudgeState({
  firstRun,
  channels,
  emailEnabled,
  dismissed,
}: NudgeInput): NudgeState {
  if (
    firstRun === undefined ||
    channels === undefined ||
    emailEnabled === undefined ||
    dismissed ||
    channels > 0 ||
    rankingsCollecting(firstRun) ||
    historyCaptures(firstRun) < ALERTS_NUDGE_MIN_CAPTURES
  ) {
    return "hidden";
  }
  return emailEnabled ? "email" : "webhook";
}

export function nudgeDismissalKey(appId: string): string {
  return `asobeast:alerts-nudge:${appId}`;
}

export function readDismissed(storage: () => Storage, appId: string): boolean {
  try {
    return storage().getItem(nudgeDismissalKey(appId)) !== null;
  } catch {
    return false;
  }
}

export function writeDismissed(storage: () => Storage, appId: string): boolean {
  try {
    storage().setItem(nudgeDismissalKey(appId), new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}
