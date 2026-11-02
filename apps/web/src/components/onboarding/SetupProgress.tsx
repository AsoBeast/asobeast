import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  SETUP_STEPS,
  type SetupStep,
  type SetupStepProgress,
  type SetupStepState,
} from "@asobeast/shared";
import { cn } from "@/lib/utils";
import {
  progressPercent,
  progressSentence,
  progressValueLabel,
  STEP_TITLES,
} from "./setup-progress";

export function SetupProgress({
  name,
  progress,
  states,
}: {
  name: string | null;
  progress: SetupStepProgress;
  states: Record<SetupStep, SetupStepState>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight text-balance">
        {progressSentence(name, progress)}
      </h2>
      <Progress
        value={progressPercent(progress)}
        aria-label="Setup progress"
        getValueLabel={() => progressValueLabel(progress)}
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
                <span>{STEP_TITLES[step]}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
