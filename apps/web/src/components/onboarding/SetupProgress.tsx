import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  SETUP_STEPS,
  type SetupStep,
  type StepProgress,
  type StepState,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import {
  progressPercent,
  progressSentence,
  STEP_TITLES,
} from "./setup-progress";

export function SetupProgress({
  name,
  progress,
  states,
}: {
  name: string | null;
  progress: StepProgress;
  states: Record<SetupStep, StepState>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight text-balance">
        {progressSentence(name, progress)}
      </h2>
      <Progress
        value={progressPercent(progress)}
        aria-label="Setup progress"
        getValueLabel={() => `${progress.done} of ${progress.total} steps`}
      />
      <nav aria-label="Setup steps">
        <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {SETUP_STEPS.map((step) => (
            <li key={step}>
              <a
                href={`#setup-${step}`}
                aria-current={progress.next === step ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 underline-offset-4 hover:underline",
                  progress.next === step
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {states[step] === "done" ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : null}
                {STEP_TITLES[step]}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
