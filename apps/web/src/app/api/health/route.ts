import { statusPageUrl } from "@/lib/status-page";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({
    status: "ok",
    statusPageUrl: statusPageUrl(process.env.STATUS_PAGE_URL),
  });
}
