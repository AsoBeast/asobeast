"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const {
    watchForm,
    hold: holdFocus,
    hand: handFocus,
  } = useAnswerFocus(LINK_SENT_FOCUS_KEY);
  const mutation = useMutation({
    mutationFn: (address: string) => requestPasswordReset(address),
    onSuccess: handFocus,
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : t("passwordReset.failed"),
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
    submitOnce(email);
  }

  if (mutation.isSuccess) {
    return (
      <AuthCard
        title={t("passwordReset.title")}
        description={t("passwordReset.sent", {
          email: mutation.variables,
        })}
        announce
      >
        <AuthActions>
          <Button asChild variant="outline">
            <Link ref={claimFocus} href="/login">
              {t("backToSignIn")}
            </Link>
          </Button>
        </AuthActions>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("passwordReset.title")}
      description={t("passwordReset.description")}
      footer={
        <Link href="/login" className={INLINE_LINK}>
          {t("backToSignIn")}
        </Link>
      }
    >
      <AuthPanel>
        <form ref={watchForm} onSubmit={submit} className="flex flex-col gap-4">
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
            {t("passwordReset.submit")}
          </Button>
        </form>
      </AuthPanel>
    </AuthCard>
  );
}
