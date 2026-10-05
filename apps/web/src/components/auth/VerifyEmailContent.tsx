"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError, resendVerification, verifyEmail } from "@/lib/api";
import { SessionNotKeptAlert } from "./SessionNotKeptAlert";
import { useSessionEntry } from "./use-session-entry";

export function VerifyEmailContent() {
  const token = useSearchParams().get("token") ?? "";

  const { mutation, sessionDropped } = useSessionEntry({
    establish: () => verifyEmail(token),
  });

  const resend = useMutation({ mutationFn: resendVerification });

  if (token === "") {
    return (
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle asChild>
            <h1>Confirmation link incomplete</h1>
          </CardTitle>
          <CardDescription>
            Open the link from your confirmation email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
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
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle asChild>
          <h1>Confirm your email</h1>
        </CardTitle>
        <CardDescription>
          Confirming starts your trial and signs you in on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          disabled={mutation.isPending || sessionDropped}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
          Confirm my email
        </Button>
        {sessionDropped ? (
          <SessionNotKeptAlert outcome="Your email is confirmed." offerSignIn />
        ) : null}
        {mutation.isError && !sessionDropped ? (
          <>
            <p className="text-body text-destructive">{reason}</p>
            <Button
              variant="outline"
              disabled={resend.isPending || resend.isSuccess}
              onClick={() => resend.mutate()}
            >
              {resend.isPending ? <Loader2 className="animate-spin" /> : null}
              {resend.isSuccess ? "New link sent" : "Send me a new link"}
            </Button>
            {resend.isError ? (
              <p className="text-body text-destructive">{resendReason}</p>
            ) : null}
          </>
        ) : null}
      </CardContent>
      <CardFooter>
        <p className="text-caption text-muted-foreground">
          Signed in as someone else? Sign out first, then open this link again.
        </p>
      </CardFooter>
    </Card>
  );
}
