import type { ReactNode } from "react";
import type { SetupStep, SetupStepState } from "@asobeast/shared";
import { PANEL_ACTION, PANEL_HEADER } from "@/components/layout/panel-classes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STEP_TITLES } from "./setup-progress";

const SKIP_REASON: Record<SetupStep, string> = {
  competitors:
    "Positions are compared against nobody until a competitor is added.",
  keywords: "Only the phrases from your listing are tracked.",
  countries: "Keywords are tracked in your home storefront only.",
};

const STATE_PILLS: Partial<Record<SetupStepState, string>> = {
  done: "Done",
  skipped: "Skipped",
};

export interface StepProps {
  state: SetupStepState;
  onSkip: (skipped: boolean) => void;
}

function SkipAction({ state, onSkip }: StepProps) {
  if (state !== "open" && state !== "skipped") return null;
  const skipped = state === "skipped";
  return (
    <Button variant="ghost" size="sm" onClick={() => onSkip(!skipped)}>
      {skipped ? "Undo skip" : "Skip this step"}
    </Button>
  );
}

export function StepPanel({
  step,
  state,
  description,
  footer,
  onSkip,
  children,
}: StepProps & {
  step: SetupStep;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pill = STATE_PILLS[state];
  return (
    <Card
      id={`setup-${step}`}
      tabIndex={-1}
      className="scroll-mt-20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h3>{STEP_TITLES[step]}</h3>
        </CardTitle>
        <CardAction className={cn(PANEL_ACTION, "flex items-center gap-2")}>
          {pill ? <Badge variant="flat">{pill}</Badge> : null}
          <SkipAction state={state} onSkip={onSkip} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="max-w-[70ch] text-dense text-muted-foreground">
          {state === "skipped" ? SKIP_REASON[step] : description}
        </p>
        {children}
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-x-3 gap-y-1">
        {footer}
      </CardFooter>
    </Card>
  );
}
