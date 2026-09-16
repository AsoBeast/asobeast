"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { PASSWORD_RULE } from "@asobeast/shared";
import { toast } from "sonner";
import { changePassword } from "@/lib/api";
import { passwordError } from "@/lib/password";
import { invalidateAuth } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  authFieldError,
  fieldErrorProps,
  type AuthFieldError,
} from "./field-error";
import { FieldErrorMessage } from "./FieldErrorMessage";

export function ChangePasswordDialog({ trigger }: { trigger: ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<AuthFieldError | null>(null);

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setCurrent("");
      setNext("");
      setError(null);
    }
  }

  const mutation = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      invalidateAuth(queryClient);
      toast.success("Password changed. Other sessions were signed out.");
      reset(false);
    },
    onError: (err) =>
      setError(authFieldError(err, "Could not change the password.")),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const problem = passwordError(next);
    if (problem) {
      setError({ field: "password", message: problem });
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              Changing your password signs out every other session.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                {...fieldErrorProps(error, "current", "current-password-error")}
                required
              />
              <FieldErrorMessage
                error={error}
                field="current"
                id="current-password-error"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="next-password">New password</Label>
              <Input
                id="next-password"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                {...fieldErrorProps(
                  error,
                  "password",
                  "next-password-error",
                  "next-password-rule",
                )}
                required
              />
              <p
                id="next-password-rule"
                className="text-xs text-muted-foreground"
              >
                {PASSWORD_RULE}
              </p>
              <FieldErrorMessage
                error={error}
                field="password"
                id="next-password-error"
              />
            </div>
            <FieldErrorMessage
              error={error}
              field="form"
              id="change-password-error"
            />
          </DialogBody>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
