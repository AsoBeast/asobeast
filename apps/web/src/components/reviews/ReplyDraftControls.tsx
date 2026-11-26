"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { useAppLocale } from "@/lib/use-app-locale";
import type { ReplyDraft } from "./use-reply-draft";

function DraftNotice({
  result,
  store,
}: {
  result: ReviewReplyDraftResult | undefined;
  store: Store;
}) {
  const t = useTranslations("reviews");
  const locale = useAppLocale();
  return (
    <div aria-live="polite" className="flex flex-col gap-1">
      {result ? (
        <p className="text-caption text-muted-foreground">
          {t("draftControls.draftedIn", {
            language: replyLanguageName(result.language, locale),
          })}
        </p>
      ) : null}
      {result?.truncated ? (
        <p className="text-caption text-warning">
          {t("draftControls.shortened", {
            store: storeLabel(store),
            limit: REVIEW_REPLY_LIMITS[store],
          })}
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
  const t = useTranslations("reviews");
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
          <SelectTrigger
            className="w-[130px] bg-card"
            aria-label={t("draftControls.tone")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REVIEW_REPLY_TONES.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`draftControls.tones.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label={t("draftControls.instructions")}
          placeholder={t("draftControls.instructionsPlaceholder")}
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
          {review.reply?.text
            ? t("draftControls.draftAgain")
            : t("draftControls.draftWithAi")}
        </Button>
      </div>
      <AiCallsLeft />
      <DraftNotice result={shown} store={store} />
    </div>
  );
}
