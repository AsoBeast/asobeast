import {
  PLANS,
  paidPlanOf,
  type PlanName,
  type WorkspaceStage,
} from "@asobeast/shared";

export const WORKSPACE_STAGE_LABELS: Record<WorkspaceStage, string> = {
  trialing: "On trial",
  paying: "Paying",
  "payment-failed": "Payment failed",
  comped: "Comped",
  "trial-ended": "Trial ended",
  churned: "Churned",
  "no-plan": "No plan",
  "self-hosted": "Self hosted",
};

export function stageLabel(
  stage: WorkspaceStage | undefined,
  plan: PlanName,
): string {
  return stage ? WORKSPACE_STAGE_LABELS[stage] : PLANS[plan].displayName;
}

export function heldPlanLabel(plan: PlanName): string | null {
  const paid = paidPlanOf(plan);
  return paid ? PLANS[paid].displayName : null;
}
