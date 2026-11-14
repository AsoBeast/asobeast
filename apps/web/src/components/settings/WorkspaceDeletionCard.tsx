"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DELETION_CONFIRMATION,
  type WorkspaceDeletionStatus,
} from "@asobeast/shared";
import {
  closeUnlessPending,
  ConfirmActionFooter,
} from "@/components/ConfirmActionFooter";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/use-auth";
import {
  ApiError,
  cancelWorkspaceDeletion,
  scheduleWorkspaceDeletion,
} from "@/lib/api";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { formatDateTime, pluralize } from "@/lib/format";
import {
  invalidateWorkspaceDeletion,
  workspaceDeletionOptions,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { PanelBody, SettingsPanel } from "./SettingsPanel";
import { PanelSkeleton } from "./skeletons";

const DELETION_FOCUS_KEY = "workspace-deletion";

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.envelope.message : fallback;
}

function ScheduleDeletionDialog({ graceDays }: { graceDays: number }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const claimFocus = useFocusClaim(DELETION_FOCUS_KEY);

  const schedule = useMutation({
    mutationFn: scheduleWorkspaceDeletion,
    onSuccess: () => {
      toast.success("Workspace scheduled for deletion");
      invalidateWorkspaceDeletion(queryClient);
      setOpen(false);
    },
    onError: (err) =>
      toast.error(messageOf(err, "Could not schedule the deletion.")),
  });
  const scheduleOnce = useSingleFlight(schedule);
  const pending = schedule.isPending;

  const onOpenChange = closeUnlessPending(pending, (next) => {
    setOpen(next);
    if (!next) setTyped("");
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button ref={claimFocus} variant="destructive" size="sm">
          Delete workspace
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            Every app, keyword and history in it is erased after{" "}
            {pluralize(graceDays, "day")}. You can cancel until then.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="workspace-deletion-confirm">
            Type {DELETION_CONFIRMATION} to confirm
          </Label>
          <Input
            id="workspace-deletion-confirm"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <ConfirmActionFooter
          pending={pending}
          label="Delete workspace"
          pendingLabel="Scheduling…"
          cancelLabel="Keep workspace"
          blocked={typed !== DELETION_CONFIRMATION}
          onConfirm={() => {
            armFocusHandoff(DELETION_FOCUS_KEY);
            scheduleOnce();
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CancelDeletionButton() {
  const queryClient = useQueryClient();
  const claimFocus = useFocusClaim(DELETION_FOCUS_KEY);
  const cancel = useMutation({
    mutationFn: cancelWorkspaceDeletion,
    onSuccess: () => {
      toast.success("Deletion cancelled");
      invalidateWorkspaceDeletion(queryClient);
    },
    onError: (err) =>
      toast.error(messageOf(err, "Could not cancel the deletion.")),
  });
  const cancelOnce = useSingleFlight(cancel);

  return (
    <Button
      ref={claimFocus}
      variant="outline"
      size="sm"
      aria-disabled={cancel.isPending || undefined}
      onClick={() => {
        if (cancel.isPending) return;
        armFocusHandoff(DELETION_FOCUS_KEY);
        cancelOnce();
      }}
    >
      {cancel.isPending ? "Cancelling…" : "Cancel deletion"}
    </Button>
  );
}

function ScheduledStatus({ deletion }: { deletion: WorkspaceDeletionStatus }) {
  return (
    <p className="text-body">
      {deletion.requestedBy ?? "The owner"} scheduled this workspace for
      deletion
      {deletion.requestedAt
        ? ` on ${formatDateTime(deletion.requestedAt)}`
        : ""}
      . It is erased on or after{" "}
      {deletion.dueAt ? formatDateTime(deletion.dueAt) : "the due date"}.
    </p>
  );
}

function OperatorNote() {
  return (
    <p className="max-w-[70ch] text-body text-muted-foreground">
      This workspace holds the platform operator. It cannot be deleted while
      other accounts exist, because the admin area, the queue dashboard and the
      support tools would go with it and no account could take them over.
      AsoBeast has no hand over yet. To clear your own data, delete its apps and
      keywords instead. Deleting this workspace is allowed only while yours is
      the only account, and it resets the instance.
    </p>
  );
}

function DeletionControl({ deletion }: { deletion: WorkspaceDeletionStatus }) {
  return deletion.scheduled ? (
    <CancelDeletionButton />
  ) : (
    <ScheduleDeletionDialog graceDays={deletion.graceDays} />
  );
}

export function WorkspaceDeletionCard() {
  const { user, isOperator } = useAuth();
  const { data: deletion, isPending } = useQuery(workspaceDeletionOptions);

  if (isPending || !user) return <PanelSkeleton title="w-36" rows={2} />;
  if (!deletion) return null;

  const isOwner = user.role === "owner";

  return (
    <SettingsPanel
      as="h2"
      title="Delete workspace"
      action={isOwner ? <DeletionControl deletion={deletion} /> : null}
    >
      <PanelBody>
        <p className="max-w-[70ch] text-body text-muted-foreground">
          Deleting erases every app, keyword and history in this workspace after
          a grace period of {pluralize(deletion.graceDays, "day")}, during which
          the owner can cancel it.
        </p>
        {isOperator ? <OperatorNote /> : null}
        {deletion.scheduled ? <ScheduledStatus deletion={deletion} /> : null}
        {isOwner ? null : (
          <p className="text-body text-muted-foreground">
            Only the workspace owner can{" "}
            {deletion.scheduled ? "cancel this" : "delete this workspace"}.
          </p>
        )}
      </PanelBody>
    </SettingsPanel>
  );
}
