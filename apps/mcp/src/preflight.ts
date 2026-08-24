import type { AccountPlan, AuthUser } from "@asobeast/shared";
import type { ApiClient } from "./client.js";

const UNENTITLED =
  "This account is not entitled — the trial has expired or a plan is required. Renew access before connecting.";

export type PreflightResult =
  { ok: true; limits: string } | { ok: false; message: string };

export async function preflight(client: ApiClient): Promise<PreflightResult> {
  const me = await client.get<AuthUser>("/auth/me");
  if (!me.ok) {
    if (me.status === 401) {
      return {
        ok: false,
        message:
          "The API token was rejected (401). Mint a fresh personal token in Settings and set ASOBEAST_API_TOKEN.",
      };
    }
    if (me.status === 402) return { ok: false, message: UNENTITLED };
    return { ok: false, message: me.message };
  }

  if (!me.data.entitled) return { ok: false, message: UNENTITLED };

  const plan = await client.get<AccountPlan>("/auth/plan");
  return { ok: true, limits: plan.ok ? describe(plan.data) : "plan unknown" };
}

function describe(plan: AccountPlan): string {
  const rate = plan.limits.mcpRequestsPerMinute;
  const ceiling = rate === null ? "unmetered" : `${rate} requests/minute`;
  return `${plan.displayName} plan, ${ceiling}`;
}
