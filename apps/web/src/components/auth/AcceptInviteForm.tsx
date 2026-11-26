"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvite } from "@/lib/api";
import { passwordError, passwordHint } from "@/lib/password";
import { useSingleFlight } from "@/lib/single-flight";
import { AuthActions, AuthCard, AuthPanel, INLINE_LINK } from "./AuthCard";
import { passwordFormError, type AuthFieldError } from "./field-error";
import { FieldErrorMessage } from "./FieldErrorMessage";
import { LegalConsent } from "./LegalConsent";
import { PasswordField } from "./PasswordField";
import { SessionNotKeptAlert } from "./SessionNotKeptAlert";
import { useSessionEntry } from "./use-session-entry";

export function AcceptInviteForm({ billing }: { billing: boolean }) {
  const t = useTranslations("auth");
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
    onFailure: (err) => setError(passwordFormError(err, t("invite.failed"), t)),
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

  if (token === "") {
    return (
      <AuthCard
        title={t("invite.incompleteTitle")}
        description={t("invite.incompleteDescription")}
      >
        <AuthActions>
          <Button asChild variant="outline">
            <Link href="/login">{t("backToSignIn")}</Link>
          </Button>
        </AuthActions>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("invite.title")}
      description={t("invite.description")}
      footer={t.rich("haveAccountLink", {
        link: (chunks) => (
          <Link href="/login" className={INLINE_LINK}>
            {chunks}
          </Link>
        ),
      })}
    >
      {sessionDropped ? (
        <SessionNotKeptAlert outcome={t("invite.joined")} offerSignIn />
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
            {t("invite.submit")}
          </Button>
          {billing ? <LegalConsent /> : null}
        </form>
      </AuthPanel>
    </AuthCard>
  );
}
