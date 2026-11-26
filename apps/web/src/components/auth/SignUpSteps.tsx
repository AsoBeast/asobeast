import { Check, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { SignUpStep, SignUpStepState } from "@/lib/sign-up-steps";
import { cn } from "@/lib/utils";

const MARK: Record<SignUpStepState, string> = {
  done: "bg-success-subtle text-success",
  current: "bg-brand-subtle text-brand-text",
  upcoming: "border border-border text-muted-foreground",
};

const LABEL: Record<SignUpStepState, string> = {
  done: "text-muted-foreground",
  current: "font-medium text-foreground",
  upcoming: "text-muted-foreground",
};

export function SignUpSteps({ steps }: { steps: readonly SignUpStep[] }) {
  const t = useTranslations("auth");
  if (steps.length === 0) return null;

  return (
    <ol
      aria-label={t("signUpSteps.label")}
      className="flex flex-col gap-2 text-body sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
    >
      {steps.map((step, index) => (
        <li
          key={step.labelKey}
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
          <span className={LABEL[step.state]}>
            {t(`signUpSteps.${step.labelKey}`)}
          </span>
          {step.state !== "current" ? (
            <span className="sr-only">{t(`signUpSteps.${step.state}`)}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function SignUpStepsAbove({
  steps,
  children,
}: {
  steps: readonly SignUpStep[];
  children: ReactNode;
}) {
  if (steps.length === 0) return children;

  return (
    <div className="my-auto flex w-full flex-col items-center gap-6">
      <SignUpSteps steps={steps} />
      {children}
    </div>
  );
}
