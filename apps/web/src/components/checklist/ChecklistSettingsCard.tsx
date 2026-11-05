"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import type { WorkspaceChecklist } from "@asobeast/shared";
import { useAuth } from "@/components/auth/use-auth";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { workspaceChecklistOptions } from "@/lib/queries";
import { pillLabel } from "./checklist-progress";
import { GoalPicker } from "./GoalPicker";
import { useChecklistSave } from "./use-checklist-save";

function ChecklistVisibility({ checklist }: { checklist: WorkspaceChecklist }) {
  const { save, pending } = useChecklistSave();
  const switchId = useId();
  const hidden = checklist.dismissedAt !== null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label htmlFor={switchId}>Show the setup checklist</Label>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">
            {pillLabel(checklist.done, checklist.total)}
          </span>
          <Switch
            id={switchId}
            checked={!hidden}
            aria-disabled={pending || undefined}
            onCheckedChange={(shown) => {
              if (pending) return;
              save(
                { dismissed: !shown },
                { failure: "Could not save the checklist setting" },
              );
            }}
          />
        </div>
      </div>
      {hidden ? (
        <p className="text-muted-foreground">
          The checklist is hidden for everyone in this workspace.
        </p>
      ) : null}
    </>
  );
}

export function ChecklistSettingsCard() {
  const { authenticated } = useAuth();
  const read = useQuery({
    ...workspaceChecklistOptions,
    enabled: authenticated,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup checklist</CardTitle>
        <CardDescription>
          The checklist floats at the bottom right of every page until every
          item is done.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {read.data ? (
          <>
            <GoalPicker as="h3" />
            <ChecklistVisibility checklist={read.data} />
          </>
        ) : null}
        {failedRead(read) ? (
          <InlineQueryError
            message="Could not load the setup checklist."
            read={read}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
