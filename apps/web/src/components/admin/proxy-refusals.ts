import type { ProxyEndpointHealth } from "@asobeast/shared";
import { pluralize } from "@/lib/format";

export interface ProxyRefusal {
  status: number;
  endpoints: number;
  sentence: string;
}

const KNOWN_REASONS: Record<number, string> = {
  402: "the plan or its quota is used up",
  407: "the provider does not accept the proxy credentials",
};

export function refusalReason(status: number): string {
  const known = KNOWN_REASONS[status];
  return `${known ?? "no reason beyond the status"} (HTTP ${status})`;
}

export function proxyRefusals(
  endpoints: readonly ProxyEndpointHealth[],
): ProxyRefusal[] {
  const refused = new Map<number, Set<string>>();
  for (const { endpointId, lastRefusalStatus } of endpoints) {
    if (lastRefusalStatus == null) continue;
    const ids = refused.get(lastRefusalStatus) ?? new Set<string>();
    ids.add(endpointId);
    refused.set(lastRefusalStatus, ids);
  }
  return [...refused]
    .map(([status, ids]) => ({
      status,
      endpoints: ids.size,
      sentence: `${pluralize(ids.size, "endpoint")} refused by the proxy provider: ${refusalReason(status)}.`,
    }))
    .sort((a, b) => b.endpoints - a.endpoints || a.status - b.status);
}
