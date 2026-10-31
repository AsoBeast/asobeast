"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { AiCallsLeft, useAiAllowanceSpent } from "@/components/ai/ai-allowance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { storeLabel } from "@/lib/format";
import { literalOf } from "@/lib/literal";
import { aiStatusOptions } from "@/lib/queries";
import { replyLanguageName } from "./reply-language";
import type { ReplyDraft } from "./use-reply-draft";

const TONE_LABELS: Record<ReviewReplyTone, string> = {
  friendly: "Friendly",
  neutral: "Neutral",
  formal: "Formal",
};

function DraftNotice({
  result,
  store,
}: {
  result: ReviewReplyDraftResult | undefined;
  store: Store;
}) {
  return (
    <div aria-live="polite" className="flex flex-col gap-1">
      {result ? (
        <p className="text-caption text-muted-foreground">
          {`Drafted in ${replyLanguageName(result.language)}`}
        </p>
      ) : null}
      {result?.truncated ? (
        <p className="text-caption text-warning">
          {`Shortened to fit ${storeLabel(store)}'s ${REVIEW_REPLY_LIMITS[store]} characters; read it before you copy.`}
        </p>
      ) : null}
    </div>
  );
}

export function ReplyDraftControls({
  review,
  store,
  busy,
  draft: { draft, drafting, result },
  text,
}: {
  review: ReviewItem;
  store: Store;
  busy: boolean;
  draft: ReplyDraft;
  text: string;
}) {
  const { data: status } = useQuery(aiStatusOptions);
  const spent = useAiAllowanceSpent();
  const [tone, setTone] = useState<ReviewReplyTone>(
    review.reply?.tone ?? "neutral",
  );
  const [instructions, setInstructions] = useState("");

  if (!status?.configured) return null;
  const shown = !drafting && result?.reply.text === text ? result : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[auto_1fr] items-center gap-2 sm:grid-cols-[auto_1fr_auto]">
        <Select
          value={tone}
          onValueChange={(next) => {
            const picked = literalOf(REVIEW_REPLY_TONES, next);
            if (picked) setTone(picked);
          }}
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
          className="order-last col-span-2 min-w-0 bg-card sm:order-none sm:col-span-1"
        />
        <Button
          variant="outline"
          size="sm"
          className="justify-self-end sm:justify-self-auto"
          onClick={() =>
            draft({ tone, instructions: instructions.trim() || undefined })
          }
          disabled={drafting || spent || busy}
        >
          {drafting ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {review.reply?.text ? "Draft again" : "Draft with AI"}
        </Button>
      </div>
      <AiCallsLeft />
      <DraftNotice result={shown} store={store} />
    </div>
  );
}
