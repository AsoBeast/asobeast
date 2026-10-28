"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { REVIEW_SCORES } from "@asobeast/shared";
import type { WebhookEvent } from "@asobeast/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, createEmailAlert } from "@/lib/api";
import { invalidateEmailAlertMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { needsAStar, reviewScoresToSend } from "./alert-event-copy";
import { AlertSubscriptionFields } from "./alert-events";
import { ConfirmDropsField } from "./ConfirmDropsField";
import { AlertChannelDialog } from "./alert-channel/AlertChannelDialog";
import { awaitsConfirmation, recipientToast } from "./email-alert-recipient";

export function AddEmailAlertDialog({ trigger }: { trigger?: ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["metadata.changed"]);
  const [stars, setStars] = useState<number[]>([...REVIEW_SCORES]);
  const [confirmDrops, setConfirmDrops] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createEmailAlert({
        email,
        events,
        reviewScores: reviewScoresToSend(events, stars),
        confirmDrops,
      }),
    onSuccess: (saved) => {
      invalidateEmailAlertMutation(queryClient);
      if (saved.confirmationSent === false) {
        toast.warning(
          `Email alert added. The confirmation email to ${saved.email} could not be sent, so use Resend confirmation to try again.`,
          recipientToast(saved),
        );
      } else {
        toast.success(
          awaitsConfirmation(saved)
            ? `Confirmation email sent to ${saved.email}`
            : "Email alert added",
          recipientToast(saved),
        );
      }
      onOpenChange(false);
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not add email alert",
      );
    },
  });
  const createOnce = useSingleFlight(mutation);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) return;
    setEmail("");
    setEvents(["metadata.changed"]);
    setStars([...REVIEW_SCORES]);
    setConfirmDrops(false);
    setError(null);
  }

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address");
      return;
    }
    if (events.length === 0) {
      setError("Select at least one event");
      return;
    }
    if (needsAStar(events, stars)) {
      setError("Pick at least one star");
      return;
    }

    createOnce();
  }

  return (
    <AlertChannelDialog
      open={open}
      onOpenChange={onOpenChange}
      label="Add email alert"
      description="AsoBeast emails this recipient when a subscribed event fires, using your configured SMTP server. Unless it is the verified account email of a member of this workspace, the recipient confirms the address from the link in a first email."
      error={error}
      pending={mutation.isPending}
      onSubmit={submit}
      trigger={trigger}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email-alert-address">Recipient email</Label>
        <Input
          id="email-alert-address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="alerts@example.com"
          aria-invalid={error !== null}
        />
      </div>

      <AlertSubscriptionFields
        events={events}
        stars={stars}
        onEventsChange={setEvents}
        onStarsChange={setStars}
      />

      <ConfirmDropsField checked={confirmDrops} onChange={setConfirmDrops} />
    </AlertChannelDialog>
  );
}
