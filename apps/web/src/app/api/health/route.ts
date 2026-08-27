import type { WebHealth } from "@/lib/api/web";
import { reportingDsn } from "@/lib/sentry";
import { statusPageUrl } from "@/lib/status-page";

export const dynamic = "force-dynamic";

export function GET(): Response {
  const health: WebHealth = {
    status: "ok",
    statusPageUrl: statusPageUrl(process.env.STATUS_PAGE_URL),
    errorReportingDsn: reportingDsn(
      process.env.SENTRY_DSN,
      process.env.NODE_ENV,
    ),
  };
  return Response.json(health);
}
