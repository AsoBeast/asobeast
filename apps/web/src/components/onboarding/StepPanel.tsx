import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
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
import { stepTitle } from "./setup-progress";

export interface StepProps {
  state: SetupStepState;
  onSkip: (skipped: boolean) => void;
}

function SkipAction({ state, onSkip }: StepProps) {
  const t = useTranslations("setup");
  if (state !== "open" && state !== "skipped") return null;
  const skipped = state === "skipped";
  return (
    <Button variant="ghost" size="sm" onClick={() => onSkip(!skipped)}>
      {t(skipped ? "panel.undoSkip" : "panel.skip")}
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
  const t = useTranslations("setup");
  const pill =
    state === "done"
      ? t("state.done")
      : state === "skipped"
        ? t("state.skipped")
        : null;
  return (
    <Card
      id={`setup-${step}`}
      tabIndex={-1}
      className="scroll-mt-20 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h3>{stepTitle(step, t)}</h3>
        </CardTitle>
        <CardAction className={cn(PANEL_ACTION, "flex items-center gap-2")}>
          {pill ? <Badge variant="flat">{pill}</Badge> : null}
          <SkipAction state={state} onSkip={onSkip} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="max-w-[70ch] text-dense text-muted-foreground">
          {state === "skipped" ? t(`steps.${step}.skipReason`) : description}
        </p>
        {children}
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-x-3 gap-y-1">
        {footer}
      </CardFooter>
    </Card>
  );
}
