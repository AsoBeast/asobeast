import { ApiError } from "@/lib/api";

export function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.envelope.message : fallback;
}
