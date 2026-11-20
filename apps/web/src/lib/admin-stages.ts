import {
  PLANS,
  RENEWAL_CADENCE,
  TRIAL_ENDING_SOON_DAYS,
  paidPlanOf,
  type AdminDepartureReason,
  type BillingInterval,
  type PaidPlanName,
  type PlanName,
  type SupportWorkspaceSummary,
  type WorkspaceStage,
} from "@asobeast/shared";
import { adminHref } from "./admin-sections";
import { DELETION_REASON_LABELS } from "./deletion-reasons";
import {
  ADMIN_WORKSPACE_FLAGS,
  type AdminWorkspaceFlag,
} from "./search-params";

export const WORKSPACE_STAGE_LABELS: Record<WorkspaceStage, string> = {
  trialing: "On trial",
  paying: "Paying",
  "payment-failed": "Payment failed",
  comped: "Comped",
  "trial-ended": "Trial ended",
  churned: "Churned",
  "no-plan": "No plan",
  "self-hosted": "Self-hosted",
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

export function payingPlanLabel(
  plan: PaidPlanName,
  interval: BillingInterval | null,
): string {
  const renews = interval ? RENEWAL_CADENCE[interval] : "interval not recorded";
  return `${PLANS[plan].displayName} · ${renews}`;
}

const DAY_MS = 24 * 60 * 60_000;

export const TRIAL_ENDING_SOON_MS = TRIAL_ENDING_SOON_DAYS * DAY_MS;

export const ADMIN_FLAG_LABELS: Record<AdminWorkspaceFlag, string> = {
  "ending-soon": `Trial ends within ${TRIAL_ENDING_SOON_DAYS} days`,
  canceling: "Canceling at period end",
  deleting: "Pending deletion",
  suspended: "Suspended",
};

export const DEPARTURE_REASON_LABELS: Record<AdminDepartureReason, string> = {
  ...DELETION_REASON_LABELS,
  unanswered: "No answer",
};

const endsSoon = (moment: string | null, now: number) =>
  moment !== null &&
  new Date(moment).getTime() > now &&
  new Date(moment).getTime() <= now + TRIAL_ENDING_SOON_MS;

const FLAG_TEST: Record<
  AdminWorkspaceFlag,
  (workspace: SupportWorkspaceSummary, now: number) => boolean
> = {
  "ending-soon": (workspace, now) =>
    workspace.stage === "trialing" && endsSoon(workspace.trialEndsAt, now),
  canceling: (workspace) =>
    workspace.cancelAtPeriodEnd === true &&
    (workspace.stage === "trialing" ||
      workspace.stage === "paying" ||
      workspace.stage === "payment-failed"),
  deleting: (workspace) => Boolean(workspace.deletionDueAt),
  suspended: (workspace) => workspace.suspendedAt !== null,
};

export function workspaceFlags(
  workspace: SupportWorkspaceSummary,
  now: number,
): AdminWorkspaceFlag[] {
  return ADMIN_WORKSPACE_FLAGS.filter((flag) =>
    FLAG_TEST[flag](workspace, now),
  );
}

export function matchesStanding(
  workspace: SupportWorkspaceSummary,
  filter: {
    stage: readonly WorkspaceStage[];
    flag: readonly AdminWorkspaceFlag[];
  },
  now: number,
): boolean {
  const flags = workspaceFlags(workspace, now);
  return (
    (filter.stage.length === 0 ||
      (workspace.stage !== undefined &&
        filter.stage.includes(workspace.stage))) &&
    filter.flag.every((flag) => flags.includes(flag))
  );
}

export const stageHref = (stage: WorkspaceStage) =>
  `${adminHref("workspaces")}?stage=${stage}`;

export const flagHref = (flag: AdminWorkspaceFlag) =>
  `${adminHref("workspaces")}?flag=${flag}`;

export const countOf = <K extends string>(
  rows: readonly { key: K; count: number }[] | undefined,
  key: K,
): number => rows?.find((row) => row.key === key)?.count ?? 0;
