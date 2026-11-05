"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { WORKSPACE_GOALS, type WorkspaceGoal } from "@asobeast/shared";
import { useAuth } from "@/components/auth/use-auth";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { Button } from "@/components/ui/button";
import { workspaceChecklistOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { GOAL_COPY } from "./checklist-copy";
import { useChecklistSave } from "./use-checklist-save";

export function GoalPicker({ as: Heading = "h2" }: { as?: "h2" | "h3" }) {
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
      <InlineQueryError message="Could not load your goal." read={read} />
    ) : null;
  }

  const choose = (goal: WorkspaceGoal) => {
    if (pending || checklist.goal === goal) return;
    save(
      { goal },
      {
        optimistic: true,
        failure: "Could not save your goal",
        onSaved: () => setAnnouncement(`Goal set to ${GOAL_COPY[goal].label}`),
      },
    );
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Heading id={headingId} className="text-title tracking-tight">
          What would you like to get done?
        </Heading>
        <p className="text-body text-muted-foreground">
          Pick one and the setup checklist starts with the steps that matter
          most. You can change it any time.
        </p>
      </div>
      <div
        role="group"
        aria-labelledby={headingId}
        className="grid gap-2 sm:grid-cols-3"
      >
        {WORKSPACE_GOALS.map((goal) => {
          const pressed = checklist.goal === goal;
          return (
            <Button
              key={goal}
              variant="outline"
              aria-pressed={pressed}
              aria-disabled={pending || undefined}
              className={cn(
                "h-auto min-w-0 flex-col items-start justify-start gap-1 p-3 text-left whitespace-normal",
                pressed && "border-primary",
              )}
              onClick={() => choose(goal)}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <span>{GOAL_COPY[goal].label}</span>
                {pressed ? (
                  <CheckCircle2
                    className="size-4 shrink-0 text-success"
                    aria-hidden
                  />
                ) : null}
              </span>
              <span className="text-caption font-normal text-muted-foreground">
                {GOAL_COPY[goal].description}
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
