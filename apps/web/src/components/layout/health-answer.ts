import { ApiError } from "@/lib/api";

const DATABASE_DOWN_STATUS = 503;

export function answeredDatabaseDown(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.envelope.statusCode === DATABASE_DOWN_STATUS
  );
}
