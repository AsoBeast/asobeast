import { getWebHealth } from "@/lib/api/web";
import { recoveryFor } from "@/lib/error-recovery";
import { reportingOptions } from "@/lib/sentry";

export function worthReporting(error: Error & { digest?: string }): boolean {
  if (error.digest) return false;
  return !recoveryFor(error).expected;
}

export async function startBrowserReporting(dsn: string): Promise<void> {
  const Sentry = await import("@sentry/nextjs");
  if (!Sentry.isInitialized()) Sentry.init(reportingOptions(dsn));
}

export async function reportBrowserError(error: unknown): Promise<void> {
  try {
    const Sentry = await import("@sentry/nextjs");
    if (!Sentry.isInitialized()) {
      const { errorReportingDsn } = await getWebHealth();
      if (!errorReportingDsn) return;
      Sentry.init(reportingOptions(errorReportingDsn));
    }
    Sentry.captureException(error);
  } catch {
    return;
  }
}
