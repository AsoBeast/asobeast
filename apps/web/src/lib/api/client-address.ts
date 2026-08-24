import type { NextRequest } from "next/server";
import { TRUSTED_PROXY_HOPS_MAX, trustedProxyHops } from "@asobeast/shared";

const TRUSTED_PROXY_HOPS = trustedProxyHops(process.env.TRUST_PROXY);

if (!Number.isInteger(TRUSTED_PROXY_HOPS)) {
  throw new Error(
    `TRUST_PROXY must be a hop count from 0 to ${TRUSTED_PROXY_HOPS_MAX}, or the boolean spelling true (one hop) or false (none). Received "${process.env.TRUST_PROXY}".`,
  );
}

const BUILDING = process.env.NEXT_PHASE === "phase-production-build";

if (
  TRUSTED_PROXY_HOPS === 0 &&
  process.env.NODE_ENV === "production" &&
  !BUILDING
) {
  console.warn(
    "TRUST_PROXY is 0 in production. The web app passes no client address to the API, so authentication throttling keys on the web container and every browser shares one bucket. Set TRUST_PROXY to the number of proxies you control between the internet and the web app, counting a Cloudflare Tunnel or your own reverse proxy as one.",
  );
}

export function trustedClientAddress(request: NextRequest): string | null {
  if (TRUSTED_PROXY_HOPS < 1) return null;
  const chain = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (chain.length < TRUSTED_PROXY_HOPS) return null;
  return chain[chain.length - TRUSTED_PROXY_HOPS];
}
