"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvite } from "@/lib/api";
import { PASSWORD_HINT, passwordError } from "@/lib/password";
import { useSingleFlight } from "@/lib/single-flight";
import { AuthActions, AuthCard, AuthPanel, INLINE_LINK } from "./AuthCard";
import { passwordFormError, type AuthFieldError } from "./field-error";
import { FieldErrorMessage } from "./FieldErrorMessage";
import { LegalConsent } from "./LegalConsent";
import { PasswordField } from "./PasswordField";
import { SessionNotKeptAlert } from "./SessionNotKeptAlert";
import { useSessionEntry } from "./use-session-entry";

export function AcceptInviteForm({ billing }: { billing: boolean }) {
  const token = useSearchParams().get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthFieldError | null>(null);

  const { mutation, sessionDropped } = useSessionEntry({
    establish: () =>
      acceptInvite({
        token,
        password,
        name: name.trim() === "" ? undefined : name.trim(),
      }),
    onFailure: (err) =>
      setError(
        passwordFormError(err, "Could not accept the invitation. Try again."),
      ),
  });
  const submitOnce = useSingleFlight(mutation);
  const locked = mutation.isPending || mutation.isSuccess || sessionDropped;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    setError(null);
    const problem = passwordError(password);
    if (problem) {
      setError({ field: "password", message: problem });
      return;
    }
    submitOnce();
  }

  if (token === "") {
    return (
      <AuthCard
        title="Invitation link incomplete"
        description="Open the link from your invitation email, or ask the workspace owner to send it again."
      >
        <AuthActions>
          <Button asChild variant="outline">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </AuthActions>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Join the workspace"
      description="Choose a password and you are in. Your email came with the invitation."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className={INLINE_LINK}>
            Sign in
          </Link>
        </>
      }
    >
      {sessionDropped ? (
        <SessionNotKeptAlert outcome="You joined the workspace." offerSignIn />
      ) : null}
      <AuthPanel>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <PasswordField
            label="Password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            hint={PASSWORD_HINT}
            error={error?.field === "password" ? error.message : null}
          />
          <FieldErrorMessage error={error} field="form" id="form-error" />
          <Button type="submit" size="lg" aria-disabled={locked || undefined}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Accept invitation
          </Button>
          {billing ? <LegalConsent /> : null}
        </form>
      </AuthPanel>
    </AuthCard>
  );
}
