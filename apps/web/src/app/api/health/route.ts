import { reportingDsn } from "@/lib/sentry";
import { statusPageUrl } from "@/lib/status-page";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({
    status: "ok",
    statusPageUrl: statusPageUrl(process.env.STATUS_PAGE_URL),
    errorReportingDsn: reportingDsn(
      process.env.SENTRY_DSN,
      process.env.NODE_ENV,
    ),
  });
}
