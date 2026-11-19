"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  SUPPORT_REASON_MAX_LENGTH,
  SUPPORT_REASON_MIN_LENGTH,
  type SupportActionRequest,
  type SupportActionResult,
  type SupportWorkspaceSummary,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTION_COPY,
  focusAfter,
  supportActionRequest,
  supportReasonReady,
  type WorkspaceAction,
} from "@/lib/admin-support";
import {
  apiErrorMessage,
  isNotFound,
  reconcileSupportWorkspace,
  restoreSupportWorkspace,
  runSupportWorkspaceDaily,
  suspendSupportWorkspace,
} from "@/lib/api";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { invalidateSupportAction } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { focusKeyOf, WORKSPACE_GONE_FOCUS_KEY } from "./focus-keys";

const SEND: Record<
  WorkspaceAction,
  (
    workspaceId: string,
    request: SupportActionRequest,
  ) => Promise<SupportActionResult>
> = {
  "run-daily": runSupportWorkspaceDaily,
  reconcile: reconcileSupportWorkspace,
  suspend: suspendSupportWorkspace,
  restore: restoreSupportWorkspace,
};

const REASON_HINT = `At least ${SUPPORT_REASON_MIN_LENGTH} characters. Kept in the support access log.`;

export function SupportActionDialog({
  workspace,
  billing,
  action,
}: {
  workspace: SupportWorkspaceSummary;
  billing: boolean;
  action: WorkspaceAction;
}) {
  const { workspaceId, name } = workspace;
  const copy = ACTION_COPY[action];
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const claimFocus = useFocusClaim(focusKeyOf(action));
  const fieldId = useId();
  const hintId = useId();

  const settle = () => {
    invalidateSupportAction(queryClient);
    setOpen(false);
    setReason("");
  };

  const mutation = useMutation({
    mutationFn: () => SEND[action](workspaceId, supportActionRequest(reason)),
    onSuccess: (result) => {
      toast.success(copy.done(name, result.detail), {
        description: result.detail,
      });
      settle();
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "Could not finish. Try again."));
      if (!isNotFound(error)) return;
      armFocusHandoff(WORKSPACE_GONE_FOCUS_KEY);
      settle();
    },
  });
  const sendOnce = useSingleFlight(mutation);
  const pending = mutation.isPending;

  return (
    <AlertDialog
      open={open}
      onOpenChange={closeUnlessPending(pending, (next) => {
        setOpen(next);
        if (!next) setReason("");
      })}
    >
      <AlertDialogTrigger asChild>
        <Button
          ref={claimFocus}
          variant="outline"
          size="sm"
          className={
            copy.variant === "destructive" ? "text-destructive" : undefined
          }
        >
          {copy.open}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="wrap-anywhere">
            {copy.title(name)}
          </AlertDialogTitle>
          <AlertDialogDescription className="wrap-anywhere">
            {copy.body(name)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId}>Reason</Label>
          <Textarea
            id={fieldId}
            dir="auto"
            value={reason}
            maxLength={SUPPORT_REASON_MAX_LENGTH}
            aria-describedby={hintId}
            onChange={(event) => setReason(event.target.value)}
          />
          <div
            id={hintId}
            className="flex justify-between gap-3 text-caption text-muted-foreground"
          >
            <span>{REASON_HINT}</span>
            <span className="numeric shrink-0">
              {`${reason.length} of ${SUPPORT_REASON_MAX_LENGTH}`}
            </span>
          </div>
        </div>
        <ConfirmActionFooter
          pending={pending}
          label={copy.confirm}
          pendingLabel={copy.pending}
          variant={copy.variant}
          blocked={!supportReasonReady(reason)}
          onConfirm={() => {
            const survivor = focusAfter(action, workspace, { billing });
            if (survivor) armFocusHandoff(focusKeyOf(survivor));
            sendOnce();
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
