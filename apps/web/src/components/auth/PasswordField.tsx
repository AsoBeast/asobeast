"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordFieldProps {
  label: string;
  autoComplete: "current-password" | "new-password";
  value: string;
  onChange: (value: string) => void;
  labelAction?: ReactNode;
  hint?: string;
  error?: string | null;
  invalid?: boolean;
  describedBy?: string;
}

const HINT_ID = "password-rule";
const ERROR_ID = "password-error";

export function PasswordField({
  label,
  autoComplete,
  value,
  onChange,
  labelAction,
  hint,
  error = null,
  invalid = error !== null,
  describedBy,
}: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const hide = () => setShown(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);
  const ownDescription = error ? ERROR_ID : hint ? HINT_ID : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <Label htmlFor="password">{label}</Label>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          ref={input}
          id="password"
          name="password"
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          aria-describedby={describedBy ?? ownDescription}
          className="pr-8"
          required
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={shown ? "Hide password" : "Show password"}
          aria-controls="password"
          className="absolute top-1 right-1"
          onClick={() => setShown((current) => !current)}
        >
          {shown ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      {error ? (
        <p id={ERROR_ID} role="alert" className="text-dense text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={HINT_ID} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
