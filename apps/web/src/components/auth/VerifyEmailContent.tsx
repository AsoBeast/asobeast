"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, resendVerification, verifyEmail } from "@/lib/api";
import { entryDestination } from "@/lib/auth-routes";
import { useSingleFlight } from "@/lib/single-flight";
import { AuthActions, AuthAside, AuthCard } from "./AuthCard";
import { SessionNotKeptAlert } from "./SessionNotKeptAlert";
import { useSessionEntry } from "./use-session-entry";

export function VerifyEmailContent() {
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
        title="Confirmation link incomplete"
        description="Open the link from your confirmation email."
      >
        <AuthActions>
          <Button asChild variant="outline">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </AuthActions>
      </AuthCard>
    );
  }

  const reason =
    mutation.error instanceof ApiError
      ? mutation.error.envelope.message
      : "That confirmation link is no longer valid.";

  const resendReason =
    resend.error instanceof ApiError && resend.error.envelope.statusCode === 401
      ? "Sign in first, then ask for a new link."
      : "Could not send a new link. Try again shortly.";

  return (
    <AuthCard
      title="Confirm your email"
      description="Confirming marks this address as yours and signs you in on this device."
    >
      {sessionDropped ? (
        <SessionNotKeptAlert outcome="Your email is confirmed." offerSignIn />
      ) : null}
      <AuthActions>
        <Button
          aria-disabled={confirmLocked || undefined}
          onClick={() => {
            if (!confirmLocked) confirmOnce();
          }}
        >
          {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
          Confirm my email
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
              {resend.isSuccess ? "New link sent" : "Send me a new link"}
            </Button>
            {resend.isError ? (
              <p className="text-dense text-destructive">{resendReason}</p>
            ) : null}
          </>
        ) : null}
      </AuthActions>
      <AuthAside>
        <p className="text-caption">
          Signed in as someone else? Sign out first, then open this link again.
        </p>
      </AuthAside>
    </AuthCard>
  );
}
