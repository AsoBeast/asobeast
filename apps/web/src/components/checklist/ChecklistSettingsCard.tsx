"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("settings");
  const { save, pending } = useChecklistSave();
  const switchId = useId();
  const hidden = checklist.dismissedAt !== null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label htmlFor={switchId}>{t("checklist.show")}</Label>
        <div className="flex items-center gap-3">
          <span className="numeric text-caption text-muted-foreground">
            {pillLabel(checklist.done, checklist.total, t)}
          </span>
          <Switch
            id={switchId}
            checked={!hidden}
            aria-disabled={pending || undefined}
            onCheckedChange={(shown) => {
              if (pending) return;
              save(
                { dismissed: !shown },
                { failure: t("checklist.saveError") },
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
          {t("checklist.hidden")}
        </p>
      ) : null}
    </div>
  );
}

export function ChecklistSettingsCard() {
  const t = useTranslations("settings");
  const { authenticated } = useAuth();
  const read = useQuery({
    ...workspaceChecklistOptions,
    enabled: authenticated,
  });

  return (
    <SettingsPanel
      as="h2"
      title={t("checklist.title")}
      footer={<p>{t("checklist.footer")}</p>}
    >
      <PanelBody className="gap-4">
        {read.data ? (
          <>
            <GoalPicker as="h3" hint={false} />
            <ChecklistVisibility checklist={read.data} />
          </>
        ) : null}
        {failedRead(read) ? (
          <InlineQueryError message={t("checklist.loadError")} read={read} />
        ) : null}
      </PanelBody>
    </SettingsPanel>
  );
}
