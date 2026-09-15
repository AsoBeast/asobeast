"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { PASSWORD_RULE } from "@asobeast/shared";
import { register } from "@/lib/api";
import { passwordError } from "@/lib/password";
import { invalidateAuth } from "@/lib/queries";
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
import {
  authFieldError,
  fieldErrorProps,
  type AuthFieldError,
} from "./field-error";
import { FieldErrorMessage } from "./FieldErrorMessage";

export function RegisterForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthFieldError | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      register({
        email,
        password,
        name: name.trim() === "" ? undefined : name.trim(),
      }),
    onSuccess: () => {
      invalidateAuth(queryClient);
      window.location.replace("/");
    },
    onError: (err) =>
      setError(authFieldError(err, "Could not create the account. Try again.")),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const problem = passwordError(password);
    if (problem) {
      setError({ field: "password", message: problem });
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1>Create account</h1>
          </CardTitle>
          <CardDescription>Set up your asobeast workspace.</CardDescription>
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
                {...fieldErrorProps(error, "email", "email-error")}
                required
              />
              <FieldErrorMessage error={error} field="email" id="email-error" />
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
                {...fieldErrorProps(
                  error,
                  "password",
                  "password-error",
                  "password-rule",
                )}
                required
              />
              <p id="password-rule" className="text-xs text-muted-foreground">
                {PASSWORD_RULE}
              </p>
              <FieldErrorMessage
                error={error}
                field="password"
                id="password-error"
              />
            </div>
            <FieldErrorMessage error={error} field="form" id="form-error" />
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Create account
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
