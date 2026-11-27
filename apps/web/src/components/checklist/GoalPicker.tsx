"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { WORKSPACE_GOALS, type WorkspaceGoal } from "@asobeast/shared";
import { useAuth } from "@/components/auth/use-auth";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { Button } from "@/components/ui/button";
import { workspaceChecklistOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { checklistGoalCopy } from "./checklist-copy";
import { useChecklistSave } from "./use-checklist-save";

export function GoalPicker({
  as: Heading = "h2",
  hint = true,
}: {
  as?: "h2" | "h3";
  hint?: boolean;
}) {
  const t = useTranslations("settings");
  const { authenticated } = useAuth();
  const read = useQuery({
    ...workspaceChecklistOptions,
    enabled: authenticated,
  });
  const checklist = read.data;
  const { save, pending } = useChecklistSave();
  const [announcement, setAnnouncement] = useState("");
  const headingId = useId();

  if (!checklist) {
    return failedRead(read) ? (
      <InlineQueryError message={t("checklist.goalLoadError")} read={read} />
    ) : null;
  }

  const choose = (goal: WorkspaceGoal) => {
    if (pending || checklist.goal === goal) return;
    save(
      { goal },
      {
        optimistic: true,
        failure: t("checklist.goalSaveError"),
        onSaved: () =>
          setAnnouncement(
            t("checklist.goalSet", {
              goal: checklistGoalCopy(goal, t).label,
            }),
          ),
      },
    );
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <Heading
          id={headingId}
          className={hint ? "text-heading" : "text-label"}
        >
          {t("checklist.question")}
        </Heading>
        {hint ? (
          <p className="text-body text-muted-foreground">
            {t("checklist.hint")}
          </p>
        ) : null}
      </div>
      <div
        role="group"
        aria-labelledby={headingId}
        className="flex flex-col gap-1"
      >
        {WORKSPACE_GOALS.map((goal) => {
          const pressed = checklist.goal === goal;
          const copy = checklistGoalCopy(goal, t);
          return (
            <Button
              key={goal}
              variant="ghost"
              aria-pressed={pressed}
              aria-disabled={pending || undefined}
              className={cn(
                "relative h-auto min-w-0 flex-col items-start justify-start gap-1 px-4 py-2 text-left whitespace-normal text-foreground",
                pressed &&
                  "bg-muted before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground",
              )}
              onClick={() => choose(goal)}
            >
              <span className="font-medium">{copy.label}</span>
              <span className="text-caption font-normal text-muted-foreground">
                {copy.description}
              </span>
            </Button>
          );
        })}
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
