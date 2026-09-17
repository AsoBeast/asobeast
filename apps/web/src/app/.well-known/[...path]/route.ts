import type { NextRequest } from "next/server";
import type { ApiErrorEnvelope } from "@asobeast/shared";

export function GET(request: NextRequest): Response {
  const envelope: ApiErrorEnvelope = {
    statusCode: 404,
    error: "Not Found",
    message:
      "asobeast publishes no OAuth metadata. Connect with a personal API token sent as Authorization: Bearer asob_…",
    path: request.nextUrl.pathname,
    timestamp: new Date().toISOString(),
  };
  return Response.json(envelope, { status: 404 });
}
