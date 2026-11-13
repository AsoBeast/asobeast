"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DELETION_CONFIRMATION,
  type WorkspaceDeletionStatus,
} from "@asobeast/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      armFocusHandoff(DELETION_FOCUS_KEY);
      invalidateWorkspaceDeletion(queryClient);
      setOpen(false);
    },
    onError: (err) =>
      toast.error(messageOf(err, "Could not schedule the deletion.")),
  });
  const scheduleOnce = useSingleFlight(schedule);
  const pending = schedule.isPending;

  function onOpenChange(next: boolean) {
    if (!next && pending) return;
    setOpen(next);
    if (!next) setTyped("");
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button ref={claimFocus} variant="destructive">
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
        <AlertDialogFooter>
          <AlertDialogCancel
            aria-disabled={pending || undefined}
            onClick={(event) => {
              if (pending) event.preventDefault();
            }}
          >
            Keep workspace
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={typed !== DELETION_CONFIRMATION}
            aria-disabled={pending || undefined}
            onClick={(event) => {
              event.preventDefault();
              if (!pending) scheduleOnce();
            }}
          >
            {pending ? "Scheduling…" : "Delete workspace"}
          </AlertDialogAction>
        </AlertDialogFooter>
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
      armFocusHandoff(DELETION_FOCUS_KEY);
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
      aria-disabled={cancel.isPending || undefined}
      onClick={() => cancelOnce()}
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
    <p className="text-body text-muted-foreground">
      This workspace holds the platform operator. It cannot be deleted while
      other accounts exist, because the admin area, the queue dashboard and the
      support tools would go with it and no account could take them over.
      AsoBeast has no hand over yet. To clear your own data, delete its apps and
      keywords instead. Deleting this workspace is allowed only while yours is
      the only account, and it resets the instance.
    </p>
  );
}

function DeletionControl({
  deletion,
  isOwner,
}: {
  deletion: WorkspaceDeletionStatus;
  isOwner: boolean;
}) {
  if (!isOwner) {
    return (
      <p className="text-body text-muted-foreground">
        Only the workspace owner can{" "}
        {deletion.scheduled ? "cancel this" : "delete this workspace"}.
      </p>
    );
  }
  return deletion.scheduled ? (
    <CancelDeletionButton />
  ) : (
    <ScheduleDeletionDialog graceDays={deletion.graceDays} />
  );
}

export function WorkspaceDeletionCard() {
  const { user, isOperator } = useAuth();
  const { data: deletion } = useQuery(workspaceDeletionOptions);

  if (!deletion || !user) return null;

  const isOwner = user.role === "owner";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete workspace</CardTitle>
        <CardDescription>
          Deleting erases every app, keyword and history in this workspace after
          a grace period of {pluralize(deletion.graceDays, "day")}, during which
          the owner can cancel it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4">
        {isOperator ? <OperatorNote /> : null}
        {deletion.scheduled ? <ScheduledStatus deletion={deletion} /> : null}
        <DeletionControl deletion={deletion} isOwner={isOwner} />
      </CardContent>
    </Card>
  );
}
