"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UPGRADE_PATH } from "@asobeast/shared";
import { ApiError } from "@/lib/api";
import {
  aiAllowanceRefusal,
  aiAllowanceSpent,
  aiCallsLeftText,
} from "@/lib/ai-allowance";
import { accountPlanOptions } from "@/lib/queries";

function useAiUsage() {
  return useQuery(accountPlanOptions).data?.usage.aiCalls;
}

export function useAiAllowanceSpent(): boolean {
  return aiAllowanceSpent(useAiUsage());
}

export function AiCallsLeft() {
  const usage = useAiUsage();
  const text = usage ? aiCallsLeftText(usage) : null;
  if (!text) return null;
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

export function useAiFailureToast(): (
  error: unknown,
  fallback: string,
) => void {
  const router = useRouter();
  return (error, fallback) => {
    const detail =
      error instanceof ApiError ? error.envelope.aiAllowance : undefined;
    if (detail) {
      toast.error(aiAllowanceRefusal(detail), {
        action: detail.upgradeTo
          ? { label: "See plans", onClick: () => router.push(UPGRADE_PATH) }
          : undefined,
      });
      return;
    }
    toast.error(error instanceof ApiError ? error.envelope.message : fallback);
  };
}
