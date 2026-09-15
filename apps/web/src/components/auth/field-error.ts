import type { ApiErrorEnvelope } from "@asobeast/shared";
import { ApiError } from "@/lib/api";

export type AuthField = "email" | "password" | "current" | "form";

export interface AuthFieldError {
  field: AuthField;
  message: string;
}

const INVALID_CURRENT_PASSWORD = "Invalid current password";

const FIELD_PREFIXES: ReadonlyArray<readonly [string, AuthField]> = [
  ["email", "email"],
  ["password", "password"],
  ["next", "password"],
  ["current", "current"],
];

export function fieldOfAuthError(
  envelope: Pick<ApiErrorEnvelope, "statusCode" | "message">,
): AuthField {
  if (envelope.statusCode === 409) return "email";
  if (
    envelope.statusCode === 401 &&
    envelope.message === INVALID_CURRENT_PASSWORD
  ) {
    return "current";
  }
  if (envelope.statusCode !== 400) return "form";
  const message = envelope.message.toLowerCase();
  return (
    FIELD_PREFIXES.find(([prefix]) => message.startsWith(prefix))?.[1] ?? "form"
  );
}

export function authFieldError(
  error: unknown,
  fallback: string,
): AuthFieldError {
  return error instanceof ApiError
    ? {
        field: fieldOfAuthError(error.envelope),
        message: error.envelope.message,
      }
    : { field: "form", message: fallback };
}

export function fieldErrorProps(
  error: AuthFieldError | null,
  field: AuthField,
  errorId: string,
  ruleId?: string,
) {
  const invalid = error?.field === field;
  const describedBy = [ruleId, invalid ? errorId : undefined]
    .filter(Boolean)
    .join(" ");
  return {
    "aria-invalid": invalid,
    "aria-describedby": describedBy === "" ? undefined : describedBy,
  };
}
