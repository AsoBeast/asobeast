"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ApiError, requestPasswordReset } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => requestPasswordReset(email),
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not send the recovery email. Try again shortly.",
      );
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1>Reset your password</h1>
          </CardTitle>
          <CardDescription>
            {mutation.isSuccess
              ? "Check your inbox."
              : "We email a link that lets you choose a new one."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mutation.isSuccess ? (
            <div className="flex flex-col gap-4">
              <p className="text-body" role="status">
                If {email} has an account, a recovery link is on its way. The
                link expires in an hour.
              </p>
              <Button asChild variant="outline">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={error !== null}
                  required
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                Email me a link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
