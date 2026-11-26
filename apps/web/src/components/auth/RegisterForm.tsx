"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useQueryState } from "nuqs";
import { useTranslations } from "next-intl";
import { register } from "@/lib/api";
import { entryDestination } from "@/lib/auth-routes";
import { planParam } from "@/lib/search-params";
import { passwordError, passwordHint } from "@/lib/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  authFieldError,
  fieldErrorProps,
  type AuthFieldError,
} from "./field-error";
import { AuthCard, AuthPanel, INLINE_LINK } from "./AuthCard";
import { FieldErrorMessage } from "./FieldErrorMessage";
import { LegalConsent } from "./LegalConsent";
import { PasswordField } from "./PasswordField";
import { SessionNotKeptAlert } from "./SessionNotKeptAlert";
import { useSessionEntry } from "./use-session-entry";
import { useSingleFlight } from "@/lib/single-flight";

export function RegisterForm({ billing }: { billing: boolean }) {
  const t = useTranslations("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthFieldError | null>(null);
  const [plan] = useQueryState("plan", planParam);

  const { mutation, sessionDropped } = useSessionEntry({
    establish: () =>
      register({
        email,
        password,
        name: name.trim() === "" ? undefined : name.trim(),
      }),
    destination: (user) => entryDestination(user, plan),
    onFailure: (err) => setError(authFieldError(err, t("register.failed"), t)),
  });
  const submitOnce = useSingleFlight(mutation);
  const locked = mutation.isPending || mutation.isSuccess || sessionDropped;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    setError(null);
    const problem = passwordError(password, t);
    if (problem) {
      setError({ field: "password", message: problem });
      return;
    }
    submitOnce();
  }

  return (
    <AuthCard
      title={t("register.title")}
      footer={t.rich("haveAccountLink", {
        link: (chunks) => (
          <Link href="/login" className={INLINE_LINK}>
            {chunks}
          </Link>
        ),
      })}
    >
      {sessionDropped ? (
        <SessionNotKeptAlert
          outcome={t("register.accountCreated")}
          offerSignIn
        />
      ) : null}
      <AuthPanel>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("nameOptional")}</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              {...fieldErrorProps(error, "email", "email-error")}
              required
            />
            <FieldErrorMessage error={error} field="email" id="email-error" />
          </div>
          <PasswordField
            label={t("password.label")}
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            hint={passwordHint(t)}
            error={error?.field === "password" ? error.message : null}
          />
          <FieldErrorMessage error={error} field="form" id="form-error" />
          <Button type="submit" size="lg" aria-disabled={locked || undefined}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("register.title")}
          </Button>
          {billing ? <LegalConsent /> : null}
        </form>
      </AuthPanel>
    </AuthCard>
  );
}
