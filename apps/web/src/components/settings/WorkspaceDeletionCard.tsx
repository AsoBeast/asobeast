"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/auth/use-auth";
import {
  cancelWorkspaceDeletion,
  scheduleWorkspaceDeletion,
  apiErrorMessage,
} from "@/lib/api";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { formatDateTimeInLocale } from "@/lib/format";
import {
  invalidateWorkspaceDeletion,
  workspaceDeletionOptions,
} from "@/lib/queries";
import {
  deletionReasonChoices,
  deletionReasonOf,
  UNANSWERED_REASON,
} from "@/lib/deletion-reasons";
import { useSingleFlight } from "@/lib/single-flight";
import { useAppLocale } from "@/lib/use-app-locale";
import { PanelBody, SettingsPanel } from "./SettingsPanel";
import { PanelSkeleton } from "./skeletons";

const DELETION_FOCUS_KEY = "workspace-deletion";

function ScheduleDeletionDialog({ graceDays }: { graceDays: number }) {
  const t = useTranslations("workspace");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState<string>(UNANSWERED_REASON);
  const claimFocus = useFocusClaim(DELETION_FOCUS_KEY);

  const schedule = useMutation({
    mutationFn: () => scheduleWorkspaceDeletion(deletionReasonOf(reason)),
    onSuccess: () => {
      toast.success(t("scheduledToast"));
      invalidateWorkspaceDeletion(queryClient);
      setOpen(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("scheduleError"))),
  });
  const scheduleOnce = useSingleFlight(schedule);
  const pending = schedule.isPending;

  const onOpenChange = closeUnlessPending(pending, (next) => {
    setOpen(next);
    if (next) return;
    setTyped("");
    setReason(UNANSWERED_REASON);
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button ref={claimFocus} variant="destructive" size="sm">
          {t("deleteWorkspace")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("confirmDescription", { days: graceDays })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="workspace-deletion-reason">{t("reasonLabel")}</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id="workspace-deletion-reason" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {deletionReasonChoices(t).map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="workspace-deletion-confirm">
            {t("confirmLabel", { confirmation: DELETION_CONFIRMATION })}
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
          label={t("deleteWorkspace")}
          pendingLabel={t("scheduling")}
          cancelLabel={t("keepWorkspace")}
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
  const t = useTranslations("workspace");
  const queryClient = useQueryClient();
  const claimFocus = useFocusClaim(DELETION_FOCUS_KEY);
  const cancel = useMutation({
    mutationFn: cancelWorkspaceDeletion,
    onSuccess: () => {
      toast.success(t("cancelledToast"));
      invalidateWorkspaceDeletion(queryClient);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("cancelError"))),
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
      {cancel.isPending ? t("cancelling") : t("cancelDeletion")}
    </Button>
  );
}

function ScheduledStatus({ deletion }: { deletion: WorkspaceDeletionStatus }) {
  const t = useTranslations("workspace");
  const locale = useAppLocale();
  const requester = deletion.requestedBy ?? t("ownerFallback");
  const scheduled = deletion.requestedAt
    ? t("scheduledOn", {
        requester,
        date: formatDateTimeInLocale(deletion.requestedAt, locale),
      })
    : t("scheduled", { requester });
  const due = deletion.dueAt
    ? formatDateTimeInLocale(deletion.dueAt, locale)
    : t("dueDateFallback");
  return (
    <p className="text-body">
      <span>{scheduled}</span>{" "}
      <span>{t("erasedOnOrAfter", { date: due })}</span>
    </p>
  );
}

function OperatorNote() {
  const t = useTranslations("workspace");
  return (
    <p className="max-w-[70ch] text-body text-muted-foreground">
      {t("operatorNote")}
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
  const t = useTranslations("workspace");
  const { user, isOperator, isLoading } = useAuth();
  const { data: deletion, isPending } = useQuery(workspaceDeletionOptions);

  if (isPending || isLoading) {
    return <PanelSkeleton title="w-36" rows={2} />;
  }
  if (!deletion || !user) return null;

  const isOwner = user.role === "owner";

  return (
    <SettingsPanel
      as="h2"
      title={t("title")}
      action={isOwner ? <DeletionControl deletion={deletion} /> : null}
    >
      <PanelBody>
        <p className="max-w-[70ch] text-body text-muted-foreground">
          {t("body", { days: deletion.graceDays })}
        </p>
        {isOperator ? <OperatorNote /> : null}
        {deletion.scheduled ? <ScheduledStatus deletion={deletion} /> : null}
        {isOwner ? null : (
          <p className="text-body text-muted-foreground">
            {deletion.scheduled ? t("memberScheduled") : t("memberUnscheduled")}
          </p>
        )}
      </PanelBody>
    </SettingsPanel>
  );
}
