import type { SetupStep, SetupStepProgress } from "@asobeast/shared";

export const STEP_TITLES: Record<SetupStep, string> = {
  competitors: "Pick competitors",
  keywords: "Track keywords",
  countries: "Add countries",
};

export const nextLabel = (step: SetupStep): string =>
  STEP_TITLES[step].toLowerCase();

export function progressSentence(
  name: string | null,
  progress: SetupStepProgress,
): string {
  const next =
    progress.next === null
      ? "ready to complete"
      : `next: ${nextLabel(progress.next)}`;
  return `Set up ${name ?? "this app"} · ${progress.done} of ${progress.total} · ${next}`;
}

export const setupSentence = (name: string | null): string =>
  `Set up ${name ?? "this app"}`;

export const loadingSentence = (name: string | null): string =>
  `${setupSentence(name)} · loading progress`;

export const progressPercent = ({ done, total }: SetupStepProgress): number =>
  total === 0 ? 0 : (done / total) * 100;
