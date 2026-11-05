import type { FirstRunStatus } from "@asobeast/shared";
import {
  rankingsCollecting,
  rankingsTracked,
} from "@/components/onboarding/first-run-timeline";

export type FirstResultsRow =
  { kind: "checking" } | { kind: "ready"; appId: string };

export function firstResultsRow(
  firstRun: FirstRunStatus | undefined,
  appId: string | null,
): FirstResultsRow | null {
  if (appId === null || firstRun === undefined || !rankingsTracked(firstRun)) {
    return null;
  }
  if (rankingsCollecting(firstRun)) return { kind: "checking" };
  const finished = firstRun.stages.every((row) => row.complete);
  return finished ? null : { kind: "ready", appId };
}
