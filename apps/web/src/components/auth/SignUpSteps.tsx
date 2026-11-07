import { Check, ChevronRight } from "lucide-react";
import {
  SIGN_UP_STEP_STATE_TEXT,
  type SignUpStep,
  type SignUpStepState,
} from "@/lib/sign-up-steps";
import { cn } from "@/lib/utils";

const MARK: Record<SignUpStepState, string> = {
  done: "bg-success-subtle text-success",
  current: "bg-primary text-primary-foreground",
  upcoming: "border border-border text-muted-foreground",
};

const LABEL: Record<SignUpStepState, string> = {
  done: "text-muted-foreground",
  current: "font-medium text-foreground",
  upcoming: "text-muted-foreground",
};

export function SignUpSteps({ steps }: { steps: readonly SignUpStep[] }) {
  if (steps.length === 0) return null;

  return (
    <ol
      aria-label="Sign up steps"
      className="flex flex-col gap-2 text-body sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
    >
      {steps.map((step, index) => (
        <li
          key={step.label}
          aria-current={step.state === "current" ? "step" : undefined}
          className="flex items-center gap-2"
        >
          {index > 0 ? (
            <ChevronRight
              aria-hidden="true"
              className="hidden size-4 text-muted-foreground sm:block"
            />
          ) : null}
          <span
            aria-hidden="true"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-medium tabular-nums",
              MARK[step.state],
            )}
          >
            {step.state === "done" ? (
              <Check className="size-3.5" />
            ) : (
              <span>{`${index + 1}`}</span>
            )}
          </span>
          <span className={LABEL[step.state]}>{step.label}</span>
          {SIGN_UP_STEP_STATE_TEXT[step.state] ? (
            <span className="sr-only">
              {SIGN_UP_STEP_STATE_TEXT[step.state]}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
