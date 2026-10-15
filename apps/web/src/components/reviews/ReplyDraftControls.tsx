"use client";

import { useState } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import {
  REVIEW_REPLY_INSTRUCTIONS_MAX,
  REVIEW_REPLY_LIMITS,
  REVIEW_REPLY_TONES,
  type ReviewItem,
  type ReviewReplyDraftResult,
  type ReviewReplyTone,
  type Store,
} from "@asobeast/shared";
import {
  AiCallsLeft,
  useAiAllowanceSpent,
  useAiFailureToast,
} from "@/components/ai/ai-allowance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { draftReviewReply } from "@/lib/api";
import { storeLabel } from "@/lib/format";
import {
  aiStatusOptions,
  invalidateAiUsage,
  invalidateReviewReplyMutation,
  upsertReviewReply,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { replyLanguageName } from "./reply-language";

const TONE_LABELS: Record<ReviewReplyTone, string> = {
  friendly: "Friendly",
  neutral: "Neutral",
  formal: "Formal",
};

export function ReplyDraftControls({
  appId,
  review,
  store,
  busy,
  onDraft,
}: {
  appId: string;
  review: ReviewItem;
  store: Store;
  busy: boolean;
  onDraft: (text: string) => void;
}) {
  const { data: status } = useSuspenseQuery(aiStatusOptions);
  const queryClient = useQueryClient();
  const spent = useAiAllowanceSpent();
  const failAi = useAiFailureToast();
  const [tone, setTone] = useState<ReviewReplyTone>(
    review.reply?.tone ?? "neutral",
  );
  const [instructions, setInstructions] = useState("");
  const drafting = useMutation({
    mutationFn: () =>
      draftReviewReply(appId, review.id, {
        tone,
        instructions: instructions.trim() || undefined,
      }),
    onSuccess: (result: ReviewReplyDraftResult) => {
      upsertReviewReply(queryClient, appId, review, result.reply);
      onDraft(result.reply.text);
    },
    onError: (error) => failAi(error, "Could not draft a reply"),
    onSettled: () => {
      invalidateAiUsage(queryClient);
      invalidateReviewReplyMutation(queryClient, appId);
    },
  });
  const draftOnce = useSingleFlight(drafting);

  if (!status.configured) return null;
  const result = drafting.data;
  const limit = REVIEW_REPLY_LIMITS[store];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <Select
          value={tone}
          onValueChange={(next) => setTone(next as ReviewReplyTone)}
        >
          <SelectTrigger className="w-[130px] bg-card" aria-label="Tone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REVIEW_REPLY_TONES.map((option) => (
              <SelectItem key={option} value={option}>
                {TONE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Instructions (optional)"
          placeholder="Instructions (optional), e.g. mention the new widgets"
          value={instructions}
          maxLength={REVIEW_REPLY_INSTRUCTIONS_MAX}
          onChange={(event) => setInstructions(event.target.value)}
          className="min-w-0 flex-1 bg-card"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => draftOnce()}
          disabled={drafting.isPending || spent || busy}
        >
          {drafting.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Sparkles />
          )}
          {review.reply?.text ? "Draft again" : "Draft with AI"}
        </Button>
      </div>
      <AiCallsLeft />
      <div aria-live="polite" className="flex flex-col gap-1">
        {result ? (
          <p className="text-caption text-muted-foreground">
            Drafted in {replyLanguageName(result.language)}
          </p>
        ) : null}
        {result?.truncated ? (
          <p className="text-caption text-warning">
            Shortened to fit {storeLabel(store)}&apos;s {limit} characters; read
            it before you copy.
          </p>
        ) : null}
      </div>
    </div>
  );
}
