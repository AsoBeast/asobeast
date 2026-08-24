import type { WorkspaceRunStatus } from "@asobeast/shared";
import { storeLabel } from "@/lib/format";

export interface RunDelayNotice {
  title: string;
  detail: string;
}

export function runDelayNotice(
  status: WorkspaceRunStatus,
): RunDelayNotice | null {
  if (status.state !== "delayed") {
    return null;
  }

  const behind = status.stores.filter(
    (store) => store.captured < store.tracked,
  );
  const names = behind.map((store) => storeLabel(store.store));
  const scope =
    names.length === 0 || names.length === status.stores.length
      ? "Today's rankings"
      : `Rankings for your ${names.join(" and ")} apps`;

  return {
    title: `${scope} are delayed`,
    detail:
      status.captured === 0
        ? "Today's run has not captured anything yet. Your stored history is unchanged, and collection resumes on its own."
        : `Today's run has captured ${status.captured} of ${status.tracked} tracked keywords. Positions you see may be from yesterday until it finishes.`,
  };
}
