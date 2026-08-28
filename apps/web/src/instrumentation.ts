import * as Sentry from "@sentry/nextjs";
import { reportingDsn, reportingOptions } from "@/lib/sentry";

export function register(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const dsn = reportingDsn(process.env.SENTRY_DSN, process.env.NODE_ENV);
  if (dsn) Sentry.init(reportingOptions(dsn));
}

export const onRequestError = Sentry.captureRequestError;
