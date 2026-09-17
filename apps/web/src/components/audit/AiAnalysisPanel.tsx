"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AppAuditResult } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, runAiAudit } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { appKeys } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

export function AiAnalysisPanel({
  appId,
  audit,
}: {
  appId: string;
  audit: AppAuditResult;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: ["audit-ai", appId],
    mutationFn: () => runAiAudit(appId),
    onSuccess: (result) =>
      queryClient.setQueryData(appKeys.audit(appId), result),
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.envelope.message : "AI audit failed",
      );
    },
  });
  const auditOnce = useSingleFlight(mutation);
  const { ai } = audit;

  return (
    <section id="ai-analysis" aria-labelledby="ai-analysis-heading">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h2 id="ai-analysis-heading" className="text-body font-medium">
              AI creative analysis
            </h2>
            <span className="text-xs text-muted-foreground">
              {!ai.configured
                ? "Add OPENAI_API_KEY to let AI read your icon and screenshots. Everything else in this audit works without it."
                : ai.generatedAt
                  ? `Last run ${formatDateTime(ai.generatedAt)}${
                      ai.model ? ` · ${ai.model}` : ""
                    }`
                  : "AI reads your icon and first six screenshots and reports what it sees. The rules score it."}
            </span>
          </div>
          {ai.configured ? (
            <Button onClick={() => auditOnce()} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              {ai.generatedAt ? "Analyze again" : "Analyze creative"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
