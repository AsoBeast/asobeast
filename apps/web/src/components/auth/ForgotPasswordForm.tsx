"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ApiError, requestPasswordReset } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocusClaim } from "@/lib/focus-handoff";
import { useSingleFlight } from "@/lib/single-flight";
import { AuthActions, AuthCard, AuthPanel, INLINE_LINK } from "./AuthCard";
import { useAnswerFocus } from "./use-answer-focus";

const REFUSED_ADDRESS_STATUS = 400;
const LINK_SENT_FOCUS_KEY = "recovery-link-sent";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const {
    watchForm,
    hold: holdFocus,
    hand: handFocus,
  } = useAnswerFocus(LINK_SENT_FOCUS_KEY);
  const mutation = useMutation({
    mutationFn: () => requestPasswordReset(email),
    onSuccess: handFocus,
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not send the recovery email. Try again shortly.",
      );
    },
  });
  const submitOnce = useSingleFlight(mutation);
  const claimFocus = useFocusClaim(LINK_SENT_FOCUS_KEY);
  const addressRefused =
    mutation.error instanceof ApiError &&
    mutation.error.envelope.statusCode === REFUSED_ADDRESS_STATUS;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    setError(null);
    holdFocus();
    submitOnce();
  }

  if (mutation.isSuccess) {
    return (
      <AuthCard
        title="Reset your password"
        description={`If ${email} has an account, a recovery link is on its way. The link expires in an hour.`}
        announce
      >
        <AuthActions>
          <Button asChild variant="outline">
            <Link ref={claimFocus} href="/login">
              Back to sign in
            </Link>
          </Button>
        </AuthActions>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we will send you a recovery link."
      footer={
        <Link href="/login" className={INLINE_LINK}>
          Back to sign in
        </Link>
      }
    >
      <AuthPanel>
        <form ref={watchForm} onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={addressRefused}
              aria-describedby={addressRefused ? "email-error" : undefined}
              required
            />
          </div>
          {error ? (
            <p
              id="email-error"
              role="alert"
              className="text-dense text-destructive"
            >
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            aria-disabled={mutation.isPending || undefined}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Email me a link
          </Button>
        </form>
      </AuthPanel>
    </AuthCard>
  );
}
