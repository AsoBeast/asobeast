"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { resetPassword } from "@/lib/api";
import { PASSWORD_HINT, passwordError } from "@/lib/password";
import { Button } from "@/components/ui/button";
import { useFocusClaim } from "@/lib/focus-handoff";
import { useSingleFlight } from "@/lib/single-flight";
import { AuthActions, AuthCard, AuthPanel } from "./AuthCard";
import { passwordFormError, type AuthFieldError } from "./field-error";
import { FieldErrorMessage } from "./FieldErrorMessage";
import { PasswordField } from "./PasswordField";
import { useAnswerFocus } from "./use-answer-focus";

const PASSWORD_SET_FOCUS_KEY = "password-set";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthFieldError | null>(null);

  const {
    watchForm,
    hold: holdFocus,
    hand: handFocus,
  } = useAnswerFocus(PASSWORD_SET_FOCUS_KEY);
  const mutation = useMutation({
    mutationFn: () => resetPassword(token, password),
    onSuccess: handFocus,
    onError: (err) =>
      setError(
        passwordFormError(
          err,
          "Could not set the new password. Ask for a fresh link.",
        ),
      ),
  });
  const submitOnce = useSingleFlight(mutation);
  const claimFocus = useFocusClaim(PASSWORD_SET_FOCUS_KEY);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    setError(null);
    const problem = passwordError(password);
    if (problem) {
      setError({ field: "password", message: problem });
      return;
    }
    holdFocus();
    submitOnce();
  }

  if (token === "") {
    return (
      <AuthCard
        title="Recovery link incomplete"
        description="Open the link from your recovery email, or ask for a new one."
      >
        <AuthActions>
          <Button asChild variant="outline">
            <Link href="/forgot-password">Ask for a new link</Link>
          </Button>
        </AuthActions>
      </AuthCard>
    );
  }

  if (mutation.isSuccess) {
    return (
      <AuthCard
        title="Choose a new password"
        description="Your password is set. Every other session has been signed out and your API tokens were revoked."
        announce
      >
        <AuthActions>
          <Button asChild>
            <Link ref={claimFocus} href="/login">
              Sign in
            </Link>
          </Button>
        </AuthActions>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Setting it signs out every device that was already signed in and revokes your API tokens."
    >
      <AuthPanel>
        <form ref={watchForm} onSubmit={submit} className="flex flex-col gap-4">
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            hint={PASSWORD_HINT}
            error={error?.field === "password" ? error.message : null}
          />
          <FieldErrorMessage error={error} field="form" id="form-error" />
          <Button
            type="submit"
            size="lg"
            aria-disabled={mutation.isPending || undefined}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Set new password
          </Button>
          {mutation.isError ? (
            <Button asChild variant="outline">
              <Link href="/forgot-password">Ask for a new link</Link>
            </Button>
          ) : null}
        </form>
      </AuthPanel>
    </AuthCard>
  );
}
