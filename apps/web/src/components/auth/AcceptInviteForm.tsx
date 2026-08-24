"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
import { ApiError, acceptInvite } from "@/lib/api";
import { invalidateAuth } from "@/lib/queries";

export function AcceptInviteForm() {
  const queryClient = useQueryClient();
  const token = useSearchParams().get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      acceptInvite({
        token,
        password,
        name: name.trim() === "" ? undefined : name.trim(),
      }),
    onSuccess: () => {
      invalidateAuth(queryClient);
      window.location.replace("/");
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not accept the invitation. Try again.",
      );
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    mutation.mutate();
  }

  if (token === "") {
    return (
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader>
          <CardTitle asChild>
            <h1>Invitation link incomplete</h1>
          </CardTitle>
          <CardDescription>
            Open the link from your invitation email, or ask the workspace owner
            to send it again.
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

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1>Join the workspace</h1>
          </CardTitle>
          <CardDescription>
            Choose a password and you are in. Your email came with the
            invitation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
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
              <p className="text-caption text-muted-foreground">
                At least 10 characters.
              </p>
            </div>
            {error ? (
              <p className="text-body text-destructive">{error}</p>
            ) : null}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Accept invitation
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-body text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
