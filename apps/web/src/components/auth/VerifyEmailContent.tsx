"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, resendVerification, verifyEmail } from "@/lib/api";
import { entryDestination } from "@/lib/auth-routes";
import { useSingleFlight } from "@/lib/single-flight";
import { AuthActions, AuthAside, AuthCard } from "./AuthCard";
import { SessionNotKeptAlert } from "./SessionNotKeptAlert";
import { useSessionEntry } from "./use-session-entry";

export function VerifyEmailContent() {
  const t = useTranslations("auth");
  const token = useSearchParams().get("token") ?? "";

  const { mutation, sessionDropped } = useSessionEntry({
    establish: () => verifyEmail(token),
    destination: (user) => entryDestination(user, null),
  });
  const confirmOnce = useSingleFlight(mutation);
  const confirmLocked =
    mutation.isPending || mutation.isSuccess || sessionDropped;

  const resend = useMutation({ mutationFn: resendVerification });
  const resendOnce = useSingleFlight(resend);
  const resendLocked = resend.isPending || resend.isSuccess;

  if (token === "") {
    return (
      <AuthCard
        title={t("verifyEmail.incompleteTitle")}
        description={t("verifyEmail.incompleteDescription")}
      >
        <AuthActions>
          <Button asChild variant="outline">
            <Link href="/login">{t("backToSignIn")}</Link>
          </Button>
        </AuthActions>
      </AuthCard>
    );
  }

  const reason =
    mutation.error instanceof ApiError
      ? mutation.error.envelope.message
      : t("verifyEmail.invalid");

  const resendReason =
    resend.error instanceof ApiError && resend.error.envelope.statusCode === 401
      ? t("verifyEmail.resendSignIn")
      : t("verifyEmail.resendFailed");

  return (
    <AuthCard
      title={t("verifyEmail.title")}
      description={t("verifyEmail.description")}
    >
      {sessionDropped ? (
        <SessionNotKeptAlert outcome={t("verifyEmail.confirmed")} offerSignIn />
      ) : null}
      <AuthActions>
        <Button
          aria-disabled={confirmLocked || undefined}
          onClick={() => {
            if (!confirmLocked) confirmOnce();
          }}
        >
          {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("verifyEmail.submit")}
        </Button>
        {mutation.isError && !sessionDropped ? (
          <>
            <p className="text-dense text-destructive">{reason}</p>
            <Button
              variant="outline"
              aria-disabled={resendLocked || undefined}
              onClick={() => {
                if (!resendLocked) resendOnce();
              }}
            >
              {resend.isPending ? <Loader2 className="animate-spin" /> : null}
              {resend.isSuccess
                ? t("resendConfirmation.newLinkSent")
                : t("verifyEmail.resend")}
            </Button>
            {resend.isError ? (
              <p className="text-dense text-destructive">{resendReason}</p>
            ) : null}
          </>
        ) : null}
      </AuthActions>
      <AuthAside>
        <p className="text-caption">{t("verifyEmail.otherSignedIn")}</p>
      </AuthAside>
    </AuthCard>
  );
}
