import {
  TRIAL_ENDING_SOON_DAYS,
  paidPlanOf,
  type AdminDepartureReason,
  type BillingInterval,
  type PaidPlanName,
  type PlanName,
  type SupportWorkspaceSummary,
  type WorkspaceStage,
} from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
import { adminHref } from "./admin-sections";
import {
  ADMIN_WORKSPACE_FLAGS,
  type AdminWorkspaceFlag,
} from "./search-params";

const STAGE_KEYS: Record<WorkspaceStage, string> = {
  trialing: "conversion.stages.trialing",
  paying: "conversion.stages.paying",
  "payment-failed": "conversion.stages.paymentFailed",
  comped: "conversion.stages.comped",
  "trial-ended": "conversion.stages.trialEnded",
  churned: "conversion.stages.churned",
  "no-plan": "conversion.stages.noPlan",
  "self-hosted": "conversion.stages.selfHosted",
};

const FLAG_KEYS: Record<AdminWorkspaceFlag, string> = {
  "ending-soon": "conversion.flags.endingSoon",
  canceling: "conversion.flags.canceling",
  deleting: "conversion.flags.deleting",
  suspended: "conversion.flags.suspended",
};

const DEPARTURE_REASON_KEYS: Record<AdminDepartureReason, string> = {
  "too-expensive": "conversion.reasons.tooExpensive",
  "missing-feature": "conversion.reasons.missingFeature",
  "not-using": "conversion.reasons.notUsing",
  "switched-tool": "conversion.reasons.switchedTool",
  other: "conversion.reasons.other",
  unanswered: "conversion.reasons.unanswered",
};

export function workspaceStageLabel(
  stage: WorkspaceStage,
  translator: MessageTranslator,
): string {
  return translator(STAGE_KEYS[stage]);
}

export function workspaceFlagLabel(
  flag: AdminWorkspaceFlag,
  translator: MessageTranslator,
): string {
  return translator(FLAG_KEYS[flag], { days: TRIAL_ENDING_SOON_DAYS });
}

export function departureReasonLabel(
  reason: AdminDepartureReason,
  translator: MessageTranslator,
): string {
  return translator(DEPARTURE_REASON_KEYS[reason]);
}

export function stageLabel(
  stage: WorkspaceStage | undefined,
  plan: PlanName,
  translator: MessageTranslator,
): string {
  return stage
    ? workspaceStageLabel(stage, translator)
    : translator(`plans.${plan}`);
}

export function heldPlanLabel(
  plan: PlanName,
  translator: MessageTranslator,
): string | null {
  const paid = paidPlanOf(plan);
  return paid ? translator(`plans.${paid}`) : null;
}

export function stageWithPlanLabel(
  stage: WorkspaceStage | undefined,
  plan: PlanName,
  translator: MessageTranslator,
): string {
  const label = stageLabel(stage, plan, translator);
  const held = stage ? heldPlanLabel(plan, translator) : null;
  return held
    ? translator("support.stageWithPlan", { stage: label, plan: held })
    : label;
}

export function payingPlanLabel(
  plan: PaidPlanName,
  interval: BillingInterval | null,
  translator: MessageTranslator,
): string {
  return translator("conversion.payingPlan", {
    plan: translator(`plans.${plan}`),
    interval: translator(
      interval
        ? `intervals.${interval === "month" ? "monthly" : "yearly"}`
        : "intervals.notRecorded",
    ),
  });
}

const DAY_MS = 24 * 60 * 60_000;

export const TRIAL_ENDING_SOON_MS = TRIAL_ENDING_SOON_DAYS * DAY_MS;

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
