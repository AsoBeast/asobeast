"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { ActionItem } from "@asobeast/shared";
import {
  AiCallsLeft,
  useAiAllowanceSpent,
  useAiFailureToast,
} from "@/components/ai/ai-allowance";
import { Button } from "@/components/ui/button";
import { explainAction } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  actionAiStatusOptions,
  invalidateActionMutation,
  invalidateAiUsage,
} from "@/lib/queries";
import { ACTION_AI_DISCLAIMER } from "./action-copy";
import { useSingleFlight } from "@/lib/single-flight";

function ExplanationNote({
  explanation,
  model,
  generatedAt,
}: {
  explanation: string;
  model: string | null;
  generatedAt: string | null;
}) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <p className="text-sm">{explanation}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {ACTION_AI_DISCLAIMER}
        {model ? ` ${model}` : ""}
        {generatedAt ? ` · ${formatDateTime(generatedAt)}` : ""}
      </p>
    </div>
  );
}

export function ActionExplain({ item }: { item: ActionItem }) {
  const queryClient = useQueryClient();
  const { data: status } = useQuery(actionAiStatusOptions);
  const spent = useAiAllowanceSpent();
  const failAi = useAiFailureToast();

  const explain = useMutation({
    mutationFn: () => explainAction(item.id),
    onError: (error) => failAi(error, "Could not summarize this action"),
    onSettled: () => {
      invalidateActionMutation(queryClient, item.scope.appId);
      invalidateAiUsage(queryClient);
    },
  });
  const explainOnce = useSingleFlight(explain);

  if (!status?.configured) return null;

  const explanation = explain.data?.explanation ?? item.ai.explanation;
  const model = explain.data?.model ?? item.ai.model;
  const generatedAt = explain.data?.generatedAt ?? item.ai.generatedAt;

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={explain.isPending || item.degraded || spent}
          onClick={() => explainOnce()}
        >
          <Sparkles aria-hidden className="size-4" />
          {explanation ? "Regenerate summary" : "Explain"}
        </Button>
        <AiCallsLeft />
        {item.category === "metadata" && (
          <Link
            href={`/apps/${item.scope.appId}/metadata`}
            className="text-sm underline-offset-4 hover:underline"
          >
            Draft metadata with the assistant
          </Link>
        )}
      </div>

      {explanation && (
        <ExplanationNote
          explanation={explanation}
          model={model}
          generatedAt={generatedAt}
        />
      )}
    </div>
  );
}
