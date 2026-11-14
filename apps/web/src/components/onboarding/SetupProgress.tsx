import { Check, Circle, Minus, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

type StepStates = Record<SetupStep, SetupStepState>;

const STATE_WORDS: Partial<Record<SetupStepState, string>> = {
  done: "Done",
  skipped: "Skipped",
};

const STATE_GLYPHS: Record<SetupStepState, LucideIcon> = {
  done: Check,
  skipped: Minus,
  open: Circle,
  loading: Circle,
};

function StepGlyph({ state }: { state: SetupStepState }) {
  const Glyph = STATE_GLYPHS[state];
  return (
    <Glyph
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0",
        state === "done" ? "text-foreground" : "text-faint-foreground",
      )}
    />
  );
}

function StepState({ state, next }: { state: SetupStepState; next: boolean }) {
  if (next) return <Badge variant="brand">Next</Badge>;
  const word = STATE_WORDS[state];
  return word ? (
    <span className="text-caption text-faint-foreground">{word}</span>
  ) : null;
}

const LIST_LAYOUTS = {
  inline: { list: "flex-wrap gap-x-6 gap-y-1", item: "" },
  stacked: { list: "flex-col", item: "" },
  rail: {
    list: "flex-wrap gap-x-6 gap-y-1 @4xl/setup:flex-col @4xl/setup:flex-nowrap @4xl/setup:gap-0",
    item: "@4xl/setup:justify-between",
  },
};

export function SetupStepList({
  states,
  next,
  layout,
  linked = false,
  className,
}: {
  states: StepStates;
  next: SetupStep | null;
  layout: keyof typeof LIST_LAYOUTS;
  linked?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("flex text-dense", LIST_LAYOUTS[layout].list, className)}>
      {SETUP_STEPS.map((step) => {
        const current = next === step;
        const title = cn(
          "min-w-0",
          current || states[step] === "open" || states[step] === "loading"
            ? "text-foreground"
            : "text-muted-foreground",
          current && "font-medium",
        );
        return (
          <li
            key={step}
            className={cn(
              "flex h-9 items-center gap-2",
              LIST_LAYOUTS[layout].item,
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <StepGlyph state={states[step]} />
              {linked ? (
                <a
                  href={`#setup-${step}`}
                  aria-current={current ? "step" : undefined}
                  className={cn(title, "rounded-sm link-underline")}
                >
                  {STEP_TITLES[step]}
                </a>
              ) : (
                <span className={title}>{STEP_TITLES[step]}</span>
              )}
            </span>
            <StepState state={states[step]} next={current} />
          </li>
        );
      })}
    </ol>
  );
}

export function SetupStepNav({
  states,
  next,
  className,
}: {
  states: StepStates;
  next: SetupStep | null;
  className?: string;
}) {
  return (
    <nav aria-label="Setup steps" className={className}>
      <SetupStepList states={states} next={next} layout="rail" linked />
    </nav>
  );
}

export function SetupProgress({
  name,
  progress,
}: {
  name: string | null;
  progress: SetupStepProgress;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-heading text-balance wrap-anywhere">
        {progressSentence(name, progress)}
      </h2>
      <Progress
        value={progressPercent(progress)}
        aria-label="Setup progress"
        getValueLabel={() => progressValueLabel(progress)}
      />
    </div>
  );
}
