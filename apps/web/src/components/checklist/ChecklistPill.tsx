"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/use-auth";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { workspaceChecklistOptions } from "@/lib/queries";
import { useStoredPreference } from "@/lib/use-stored-preference";
import { cn } from "@/lib/utils";
import { ChecklistPanel } from "./ChecklistPanel";
import {
  pillLabel,
  pillVisible,
  progressAnnouncement,
  type ChecklistProgress,
} from "./checklist-progress";
import { ProgressRing } from "./ProgressRing";

export const CHECKLIST_COLLAPSED = "asobeast.checklist.collapsed";

function useProgressAnnouncement(progress: ChecklistProgress | null): string {
  const [seen, setSeen] = useState<ChecklistProgress | null>(null);
  const [announcement, setAnnouncement] = useState("");
  if (
    progress !== null &&
    (seen?.done !== progress.done || seen.total !== progress.total)
  ) {
    setSeen(progress);
    const sentence = progressAnnouncement(seen, progress);
    if (sentence !== null) setAnnouncement(sentence);
  }
  return announcement;
}

export function ChecklistPill() {
  const { authenticated, user } = useAuth();
  const { data: checklist } = useQuery({
    ...workspaceChecklistOptions,
    enabled: authenticated && user?.entitled === true,
  });
  const [collapsedValue, saveCollapsed] =
    useStoredPreference(CHECKLIST_COLLAPSED);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const summaryId = useId();
  const announcement = useProgressAnnouncement(
    checklist ? { done: checklist.done, total: checklist.total } : null,
  );

  if (!checklist || !pillVisible(checklist)) return null;

  const collapsed = collapsedValue === "1";
  const label = pillLabel(checklist.done, checklist.total);

  return (
    <>
      <div aria-hidden className="h-12 print:hidden" />
      <div className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 print:hidden">
        <p role="status" className="sr-only">
          {announcement}
        </p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-10 rounded-full bg-popover shadow-overlay",
                collapsed ? "w-10 px-0" : "px-3",
              )}
            >
              <ProgressRing done={checklist.done} total={checklist.total} />
              <span className={collapsed ? "sr-only" : undefined}>{label}</span>
              <span className="sr-only"> in the setup checklist</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            collisionPadding={16}
            aria-labelledby={titleId}
            aria-describedby={summaryId}
            className="max-h-(--radix-popover-content-available-height) w-96 max-w-(--radix-popover-content-available-width) overflow-y-auto p-4"
          >
            <ChecklistPanel
              checklist={checklist}
              titleId={titleId}
              summaryId={summaryId}
              collapsed={collapsed}
              onToggleCollapsed={() => saveCollapsed(collapsed ? "0" : "1")}
              onNavigate={() => setOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
