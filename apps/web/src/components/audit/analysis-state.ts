import type { AiProvider, AppAuditResult } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enAudit from "../../../messages/en/audit.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "audit",
  messages: { audit: enAudit },
});

export type AnalysisState =
  | "unconfigured"
  | "never"
  | "requesting"
  | "active"
  | "current"
  | "stale"
  | "failed";

export function analysisState(
  audit: AppAuditResult,
  requesting: boolean,
): AnalysisState {
  if (!audit.ai.configured) return "unconfigured";
  if (requesting) return "requesting";
  const state = audit.ai.run?.state;
  if (state === "queued" || state === "running") return "active";
  if (state === "failed") return "failed";
  if (audit.creative?.stale) return "stale";
  if (state === "completed" && audit.creative) return "current";
  return "never";
}

export const analysisCopy = (
  state: AnalysisState,
  t: MessageTranslator = english,
): string => t(`analysisCopy.${state}`);

export const analysisAction = (
  state: AnalysisState,
  t: MessageTranslator = english,
): string | null => {
  if (state === "unconfigured" || state === "active" || state === "current") {
    return null;
  }
  return t(`analysisAction.${state}`);
};

export const progressLine = (
  screenshots: number | null,
  t: MessageTranslator = english,
): string =>
  screenshots === null
    ? t("analysisProgress.all")
    : t("analysisProgress.some", { count: screenshots });

const SENDS_CREATIVE: ReadonlySet<AnalysisState> = new Set([
  "never",
  "stale",
  "failed",
]);

export const sendsCreative = (state: AnalysisState): boolean =>
  SENDS_CREATIVE.has(state);

export const creativeSentLine = (
  provider: AiProvider | null | undefined,
  model: string | null,
  t: MessageTranslator = english,
): string => {
  if (provider === "compatible") {
    const configuredProvider = t("analysisSent.configuredProvider");
    return model === null
      ? t("analysisSent.configured", { provider: configuredProvider })
      : t("analysisSent.configuredModel", {
          model,
          provider: configuredProvider,
        });
  }
  return model === null
    ? t("analysisSent.openai")
    : t("analysisSent.openaiModel", { model });
};

export const AI_FEATURES_GUIDE = "https://docs.asobeast.com/guides/ai-features";
