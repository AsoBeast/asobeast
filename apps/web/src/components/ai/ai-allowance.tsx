"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UPGRADE_PATH } from "@asobeast/shared";
import { ApiError, apiErrorMessage } from "@/lib/api";
import {
  aiAllowanceRefusal,
  aiAllowanceSpent,
  aiCallsLeftText,
} from "@/lib/ai-allowance";
import { accountPlanOptions } from "@/lib/queries";
import { useAppLocale } from "@/lib/use-app-locale";

function useAiUsage() {
  return useQuery(accountPlanOptions).data?.usage.aiCalls;
}

export function useAiAllowanceSpent(): boolean {
  return aiAllowanceSpent(useAiUsage());
}

export function AiCallsLeft() {
  const t = useTranslations("billing");
  const locale = useAppLocale();
  const usage = useAiUsage();
  const text = usage ? aiCallsLeftText(usage, { translator: t, locale }) : null;
  if (!text) return null;
  return <p className="text-caption text-muted-foreground">{text}</p>;
}

export function useAiFailureToast(): (
  error: unknown,
  fallback: string,
) => void {
  const router = useRouter();
  const t = useTranslations("billing");
  const locale = useAppLocale();
  const context = { translator: t, locale };
  return (error, fallback) => {
    const detail =
      error instanceof ApiError ? error.envelope.aiAllowance : undefined;
    if (detail) {
      toast.error(aiAllowanceRefusal(detail, context), {
        action: detail.upgradeTo
          ? {
              label: t("ai.seePlans"),
              onClick: () => router.push(UPGRADE_PATH),
            }
          : undefined,
      });
      return;
    }
    toast.error(apiErrorMessage(error, fallback));
  };
}
