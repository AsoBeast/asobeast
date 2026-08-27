import { recoveryFor } from "@/lib/error-recovery";

export function worthReporting(error: Error & { digest?: string }): boolean {
  if (error.digest) return false;
  return !recoveryFor(error).expected;
}
