"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/use-auth";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { focusIsLost, useFocusAfterCommit } from "@/lib/focus-handoff";
import { workspaceChecklistOptions } from "@/lib/queries";
import { useStoredPreference } from "@/lib/use-stored-preference";
import { cn } from "@/lib/utils";
import { ChecklistPanel } from "./ChecklistPanel";
import { HideChecklistDialog } from "./HideChecklistDialog";
import {
  pillLabel,
  pillVisible,
  progressAnnouncement,
  type ChecklistProgress,
} from "./checklist-progress";
import { ProgressRing } from "./ProgressRing";
import { useChecklistSave } from "./use-checklist-save";

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

function useFocusRescue(
  visible: boolean,
  open: boolean,
  content: RefObject<HTMLDivElement | null>,
): void {
  const wasVisible = useRef(false);
  useEffect(() => {
    if (focusIsLost()) {
      if (visible && open) content.current?.focus();
      if (wasVisible.current && !visible) {
        document.getElementById("main-content")?.focus();
      }
    }
    wasVisible.current = visible;
  });
}

export function ChecklistPill() {
  const { authenticated, user } = useAuth();
  return authenticated && user?.entitled === true ? <EntitledPill /> : null;
}

function EntitledPill() {
  const { data: checklist } = useQuery(workspaceChecklistOptions);
  const [collapsedValue, saveCollapsed] =
    useStoredPreference(CHECKLIST_COLLAPSED);
  const [open, setOpen] = useState(false);
  const [hiding, setHiding] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const focusAfterCommit = useFocusAfterCommit();
  const { save, pending } = useChecklistSave();
  const titleId = useId();
  const summaryId = useId();
  const announcement = useProgressAnnouncement(
    checklist ? { done: checklist.done, total: checklist.total } : null,
  );

  const visible = checklist !== undefined && pillVisible(checklist);
  useFocusRescue(visible, open, content);

  if (!visible || !checklist) return null;

  const collapsed = collapsedValue === "1";
  const label = pillLabel(checklist.done, checklist.total);

  const startHiding = () => {
    setOpen(false);
    setHiding(true);
  };

  const confirmHide = () =>
    save(
      { dismissed: true },
      {
        failure: "Could not hide the setup checklist",
        onSaved: () => {
          focusAfterCommit(document.getElementById("main-content"));
          setHiding(false);
          toast.success("Setup checklist hidden. Show it again in Settings.");
        },
      },
    );

  return (
    <>
      <div aria-hidden className="h-12 print:hidden" />
      <div
        data-slot="checklist-pill"
        className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 print:hidden"
      >
        <p role="status" className="sr-only">
          {announcement}
        </p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={trigger}
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
            ref={content}
            side="top"
            align="end"
            collisionPadding={16}
            aria-labelledby={titleId}
            aria-describedby={summaryId}
            className="max-h-(--radix-popover-content-available-height) w-96 print:hidden max-w-(--radix-popover-content-available-width) overflow-y-auto p-4"
          >
            <ChecklistPanel
              checklist={checklist}
              titleId={titleId}
              summaryId={summaryId}
              collapsed={collapsed}
              onToggleCollapsed={() => saveCollapsed(collapsed ? "0" : "1")}
              onHide={startHiding}
              onNavigate={() => setOpen(false)}
            />
          </PopoverContent>
        </Popover>
        <HideChecklistDialog
          open={hiding}
          onOpenChange={setHiding}
          onConfirm={confirmHide}
          pending={pending}
          returnFocus={trigger}
        />
      </div>
    </>
  );
}
