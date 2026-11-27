"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { ApiError, login } from "@/lib/api";
import { saysRegistrationClosed, signedInDestination } from "@/lib/auth-routes";
import { useSingleFlight } from "@/lib/single-flight";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, AuthPanel, INLINE_LINK } from "./AuthCard";
import { authApiErrorMessage } from "./field-error";
import { PasswordField } from "./PasswordField";
import { SessionNotKeptAlert } from "./SessionNotKeptAlert";
import { useAuth } from "./use-auth";
import { useSessionEntry } from "./use-session-entry";

const REFUSED_CREDENTIAL_STATUS = 401;

export function LoginForm() {
  const params = useSearchParams();
  const t = useTranslations("auth");
  const { status } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutation, sessionDropped } = useSessionEntry({
    establish: () => login(email, password),
    destination: () => signedInDestination(params.get("next")),
    onFailure: (err) => {
      setError(authApiErrorMessage(err, t("signInFailed"), t));
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
      title={t("signIn")}
      description={
        saysRegistrationClosed(params) ? t("registrationClosed") : undefined
      }
      footer={
        status?.registrationOpen
          ? t.rich("needAccountLink", {
              link: (chunks) => (
                <Link href="/register" className={INLINE_LINK}>
                  {chunks}
                </Link>
              ),
            })
          : undefined
      }
    >
      {sessionDropped ? (
        <SessionNotKeptAlert outcome={t("sessionDropped")} />
      ) : null}
      <AuthPanel>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
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
            label={t("password.label")}
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
                {t("forgotPassword")}
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
            {t("signIn")}
          </Button>
        </form>
      </AuthPanel>
    </AuthCard>
  );
}
