import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api/proxy";

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  return proxyToApi(request, ["admin", "queues", ...(path ?? [])]);
}

export {
  forward as GET,
  forward as POST,
  forward as PUT,
  forward as PATCH,
  forward as DELETE,
};
