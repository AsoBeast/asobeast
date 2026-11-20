"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ApiError, login } from "@/lib/api";
import { saysRegistrationClosed, signedInDestination } from "@/lib/auth-routes";
import { useSingleFlight } from "@/lib/single-flight";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, AuthPanel, INLINE_LINK } from "./AuthCard";
import { PasswordField } from "./PasswordField";
import { SessionNotKeptAlert } from "./SessionNotKeptAlert";
import { useAuth } from "./use-auth";
import { useSessionEntry } from "./use-session-entry";

const REFUSED_CREDENTIAL_STATUS = 401;

export function LoginForm() {
  const params = useSearchParams();
  const { status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutation, sessionDropped } = useSessionEntry({
    establish: () => login(email, password),
    destination: () => signedInDestination(params.get("next")),
    onFailure: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not sign in. Try again.",
      );
    },
  });
  const submitOnce = useSingleFlight(mutation);
  const locked = mutation.isPending || mutation.isSuccess;
  const credentialRefused =
    mutation.error instanceof ApiError &&
    mutation.error.envelope.statusCode === REFUSED_CREDENTIAL_STATUS;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    setError(null);
    submitOnce();
  }

  return (
    <AuthCard
      title="Sign in"
      description={
        saysRegistrationClosed(params)
          ? "Registration is closed on this deployment. Ask the owner for an account."
          : undefined
      }
      footer={
        status?.registrationOpen ? (
          <>
            Need an account?{" "}
            <Link href="/register" className={INLINE_LINK}>
              Create one
            </Link>
          </>
        ) : undefined
      }
    >
      {sessionDropped ? (
        <SessionNotKeptAlert outcome="Your password was accepted." />
      ) : null}
      <AuthPanel>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={credentialRefused}
              aria-describedby={credentialRefused ? "login-error" : undefined}
              required
            />
          </div>
          <PasswordField
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            invalid={credentialRefused}
            describedBy={credentialRefused ? "login-error" : undefined}
            labelAction={
              <Link
                href="/forgot-password"
                className={cn(INLINE_LINK, "text-label font-normal")}
              >
                Forgot password?
              </Link>
            }
          />
          {error ? (
            <p
              id="login-error"
              role="alert"
              className="text-dense text-destructive"
            >
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" aria-disabled={locked || undefined}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Sign in
          </Button>
        </form>
      </AuthPanel>
    </AuthCard>
  );
}
