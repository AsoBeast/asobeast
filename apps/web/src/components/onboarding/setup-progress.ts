import type { SetupStep, StepProgress } from "@/lib/onboarding";

export const STEP_TITLES: Record<SetupStep, string> = {
  competitors: "Pick competitors",
  keywords: "Track keywords",
  countries: "Add countries",
};

export const nextLabel = (step: SetupStep): string =>
  STEP_TITLES[step].toLowerCase();

export function progressSentence(
  name: string | null,
  progress: StepProgress,
): string {
  const next =
    progress.next === null
      ? "ready to complete"
      : `next: ${nextLabel(progress.next)}`;
  return `Set up ${name ?? "this app"} · ${progress.done} of ${progress.total} · ${next}`;
}

export const loadingSentence = (name: string | null): string =>
  `Set up ${name ?? "this app"} · loading progress`;

export const progressPercent = ({ done, total }: StepProgress): number =>
  total === 0 ? 0 : (done / total) * 100;
