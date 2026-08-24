"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ApiError, resetPassword } from "@/lib/api";
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

const MIN_PASSWORD = 10;

export function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => resetPassword(token, password),
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not set the new password. Ask for a fresh link.",
      );
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    mutation.mutate();
  }

  if (token === "") {
    return (
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle asChild>
            <h1>Recovery link incomplete</h1>
          </CardTitle>
          <CardDescription>
            Open the link from your recovery email, or ask for a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/forgot-password">Ask for a new link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1>Choose a new password</h1>
          </CardTitle>
          <CardDescription>
            {mutation.isSuccess
              ? "Every other session has been signed out."
              : "Setting it signs out every device that was already signed in."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mutation.isSuccess ? (
            <div className="flex flex-col gap-4">
              <p className="text-body" role="status">
                Your password is set. Sign in with it now.
              </p>
              <Button asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={error !== null}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  At least {MIN_PASSWORD} characters.
                </p>
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                Set new password
              </Button>
              {mutation.isError ? (
                <Button asChild variant="outline">
                  <Link href="/forgot-password">Ask for a new link</Link>
                </Button>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
