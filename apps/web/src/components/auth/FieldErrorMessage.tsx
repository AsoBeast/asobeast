import type { AuthField, AuthFieldError } from "./field-error";

export function FieldErrorMessage({
  error,
  field,
  id,
}: {
  error: AuthFieldError | null;
  field: AuthField;
  id: string;
}) {
  if (error?.field !== field) return null;
  return (
    <p
      id={id}
      role={field === "form" ? "alert" : undefined}
      className="text-sm text-destructive"
    >
      {error.message}
    </p>
  );
}
