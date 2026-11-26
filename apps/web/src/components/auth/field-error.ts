import type { ApiErrorEnvelope } from "@asobeast/shared";
import { ApiError } from "@/lib/api";
import type { MessageTranslator } from "@/i18n/translator";

export type AuthField = "email" | "password" | "current" | "form";

export interface AuthFieldError {
  field: AuthField;
  message: string;
}

const INVALID_CURRENT_PASSWORD = "Invalid current password";

const FAILURE_KEYS: Readonly<Record<string, string>> = {
  "Invalid email or password": "invalidCredentials",
  "Email already registered": "emailRegistered",
  "That email already has an account": "emailRegistered",
  "Invalid current password": "invalidCurrentPassword",
  "That verification link has expired": "linkExpired",
  "That confirmation link has expired": "linkExpired",
  "That confirmation link is no longer valid": "linkInvalid",
};

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

export function authApiErrorMessage(
  error: unknown,
  fallback: string,
  translator?: MessageTranslator,
): string {
  if (!(error instanceof ApiError)) return fallback;
  const key = FAILURE_KEYS[error.envelope.message];
  if (key === undefined) return translator ? fallback : error.envelope.message;
  return translator ? translator(key) : error.envelope.message;
}

export function authFieldError(
  error: unknown,
  fallback: string,
  translator?: MessageTranslator,
): AuthFieldError {
  return error instanceof ApiError
    ? {
        field: fieldOfAuthError(error.envelope),
        message: authApiErrorMessage(error, fallback, translator),
      }
    : { field: "form", message: fallback };
}

export function passwordFormError(
  error: unknown,
  fallback: string,
  translator?: MessageTranslator,
): AuthFieldError {
  const found = authFieldError(error, fallback, translator);
  return found.field === "password" ? found : { ...found, field: "form" };
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
