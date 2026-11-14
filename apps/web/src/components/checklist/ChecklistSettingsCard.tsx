"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import type { WorkspaceChecklist } from "@asobeast/shared";
import { useAuth } from "@/components/auth/use-auth";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { PanelBody, SettingsPanel } from "@/components/settings/SettingsPanel";
import { Progress } from "@/components/ui/progress";
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label htmlFor={switchId}>Show the setup checklist</Label>
        <div className="flex items-center gap-3">
          <span className="numeric text-caption text-muted-foreground">
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
      <Progress
        aria-hidden
        value={
          checklist.total === 0 ? 0 : (checklist.done / checklist.total) * 100
        }
      />
      {hidden ? (
        <p className="text-caption text-muted-foreground">
          The checklist is hidden for everyone in this workspace.
        </p>
      ) : null}
    </div>
  );
}

export function ChecklistSettingsCard() {
  const { authenticated } = useAuth();
  const read = useQuery({
    ...workspaceChecklistOptions,
    enabled: authenticated,
  });

  return (
    <SettingsPanel
      as="h2"
      title="Getting started"
      footer={
        <p>
          The checklist floats at the bottom right of every page until every
          item is done.
        </p>
      }
    >
      <PanelBody className="gap-4">
        {read.data ? (
          <>
            <GoalPicker as="h3" hint={false} />
            <ChecklistVisibility checklist={read.data} />
          </>
        ) : null}
        {failedRead(read) ? (
          <InlineQueryError
            message="Could not load the setup checklist."
            read={read}
          />
        ) : null}
      </PanelBody>
    </SettingsPanel>
  );
}
