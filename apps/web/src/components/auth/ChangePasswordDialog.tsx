"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changePassword } from "@/lib/api";
import { passwordError, passwordHint } from "@/lib/password";
import { invalidatePasswordChange } from "@/lib/queries";
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
import { useSingleFlight } from "@/lib/single-flight";

export function ChangePasswordDialog({ trigger }: { trigger: ReactNode }) {
  const t = useTranslations("auth");
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
      invalidatePasswordChange(queryClient);
      toast.success(t("password.changed"));
      reset(false);
    },
    onError: (err) =>
      setError(authFieldError(err, t("password.changeFailed"), t)),
  });
  const submitOnce = useSingleFlight(mutation);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const problem = passwordError(next, t);
    if (problem) {
      setError({ field: "password", message: problem });
      return;
    }
    submitOnce();
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("password.changeTitle")}</DialogTitle>
            <DialogDescription>
              {t("password.changeDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-2">
              <Label htmlFor="current-password">{t("password.current")}</Label>
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
              <Label htmlFor="next-password">{t("password.new")}</Label>
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
                className="text-caption text-muted-foreground"
              >
                {passwordHint(t)}
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
              {t("password.changeSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
