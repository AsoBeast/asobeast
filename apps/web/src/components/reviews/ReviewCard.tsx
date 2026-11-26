"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ReviewItem, Store } from "@asobeast/shared";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";
import { ReplyStateMark } from "./ReplyStateMark";
import {
  reviewActionLabel,
  reviewSubject,
  type ReviewTwin,
} from "./review-subject";

type ActionLabel = (action: string) => string;
import { translationCaption } from "./review-translation";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { useReviewTranslation } from "./use-review-translation";

const LINK_BUTTON =
  "rounded-sm text-caption font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none";

function Stars({ score }: { score: number }) {
  const t = useTranslations("reviews");
  return (
    <span
      className="shrink-0 text-label leading-6 tracking-wide text-foreground"
      role="img"
      aria-label={t("card.stars", { score })}
    >
      <span aria-hidden>
        {"★".repeat(score)}
        <span className="text-faint-foreground">{"☆".repeat(5 - score)}</span>
      </span>
    </span>
  );
}

function useOverflowing<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () =>
      setOverflowing(node.scrollHeight > node.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, overflowing] as const;
}

function ReviewText({ text, label }: { text: string; label: ActionLabel }) {
  const t = useTranslations("reviews");
  const [expanded, setExpanded] = useState(false);
  const [ref, overflowing] = useOverflowing<HTMLParagraphElement>();

  return (
    <div className="flex flex-col items-start gap-1">
      <p
        ref={ref}
        dir="auto"
        className={cn(
          "w-full text-body wrap-anywhere whitespace-pre-line",
          expanded ? null : "line-clamp-4",
        )}
      >
        {text}
      </p>
      {expanded || overflowing ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={label(
            t(expanded ? "card.showLessOf" : "card.showMoreOf"),
          )}
          className={LINK_BUTTON}
        >
          {t(expanded ? "card.showLess" : "card.showMore")}
        </button>
      ) : null}
    </div>
  );
}

function DeveloperReply({ review }: { review: ReviewItem }) {
  const t = useTranslations("reviews");
  const locale = useAppLocale();
  if (!review.replyText) return null;
  return (
    <div className="flex flex-col gap-1 border-l-2 border-border pl-3">
      <p className="text-caption text-muted-foreground">
        {t("card.developerReply")}
        {review.repliedAt
          ? ` · ${formatDateInLocale(review.repliedAt, locale)}`
          : null}
      </p>
      <p dir="auto" className="text-body wrap-anywhere whitespace-pre-line">
        {review.replyText}
      </p>
    </div>
  );
}

function reviewFacts(
  review: ReviewItem,
  t: MessageTranslator,
  locale: Locale,
): string {
  return t("card.facts", {
    date: formatDateInLocale(review.reviewedAt, locale),
    version: review.version
      ? t("card.version", { version: review.version })
      : "",
  });
}

type ReviewTranslationState = ReturnType<typeof useReviewTranslation>;

function translateAction(
  translation: ReviewTranslationState,
  t: MessageTranslator,
): {
  text: string;
  lead: string | null;
} {
  if (translation.pending) return { text: t("card.translating"), lead: null };
  if (translation.translation) {
    return { text: t("card.showOriginal"), lead: t("card.showOriginalOf") };
  }
  if (translation.kept) {
    return {
      text: t("card.showTranslation"),
      lead: t("card.showTranslationOf"),
    };
  }
  return { text: t("card.translate"), lead: t("card.translate") };
}

function TranslateButton({
  translation,
  label,
}: {
  translation: ReviewTranslationState;
  label: ActionLabel;
}) {
  const t = useTranslations("reviews");
  if (!translation.offered) return null;
  const { text, lead } = translateAction(translation, t);
  return (
    <button
      type="button"
      onClick={translation.toggle}
      disabled={translation.disabled}
      aria-label={lead ? label(lead) : undefined}
      className={LINK_BUTTON}
    >
      {text}
    </button>
  );
}

export function ReviewCard({
  appId,
  store,
  fallbackLanguage,
  review,
  twin,
  open = false,
  actions,
  children,
}: {
  appId: string;
  store: Store;
  fallbackLanguage: string | null;
  review: ReviewItem;
  twin?: ReviewTwin;
  open?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const t = useTranslations("reviews");
  const locale = useAppLocale();
  const translation = useReviewTranslation(appId, review, fallbackLanguage);
  const shown = translation.translation;
  const title = shown ? shown.title : review.title;
  const text = shown ? shown.text : review.text;
  const label: ActionLabel = (action) =>
    reviewActionLabel(action, review, twin, t, locale);
  return (
    <article
      aria-label={reviewSubject(review, twin, t, locale)}
      data-open={open || undefined}
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 8rem" }}
      className="flex flex-col gap-2 p-4 data-[open]:bg-muted data-[open]:shadow-[inset_2px_0_0_var(--foreground)] max-sm:px-3"
    >
      <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1">
        <Stars score={review.score} />
        {title ? (
          <span
            dir="auto"
            className="min-w-[40%] flex-1 text-body font-medium wrap-anywhere"
          >
            {title}
          </span>
        ) : null}
        <ReplyStateMark
          review={review}
          store={store}
          className="ml-auto leading-6"
        />
      </div>
      {text.trim() ? (
        <ReviewText
          key={shown ? "translated" : "original"}
          text={text}
          label={label}
        />
      ) : (
        <p className="text-body text-faint-foreground">{t("card.noWritten")}</p>
      )}
      {shown ? (
        <p className="text-caption text-muted-foreground">
          {translationCaption(shown.sourceLanguage, t, locale)}
        </p>
      ) : null}
      <DeveloperReply review={review} />
      <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-caption text-faint-foreground wrap-anywhere">
          <bdi>{review.userName ?? t("anonymous")}</bdi>
          <span>{reviewFacts(review, t, locale)}</span>
        </p>
        <TranslateButton translation={translation} label={label} />
        {actions}
      </div>
      {children}
    </article>
  );
}
