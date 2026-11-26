"use client";

import Link from "next/link";
import { useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  KEYWORD_FIELD_CHAR_LIMIT,
  type AppLocalizationItem,
  type AppLocalizationStoreSync,
} from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  keywordFieldDraft,
  readingStorefrontNames,
  type KeywordFieldDraft,
} from "@/lib/app-localizations";
import { formatDateTimeInLocale, formatListInLocale } from "@/lib/format";
import { localizationNameInLocale } from "@/lib/localizations";
import { useAppLocale } from "@/lib/use-app-locale";
import { proposalDraft } from "@/lib/keyword-field-addition";
import { STORE_CONNECTIONS_PATH } from "@/lib/store-connection-copy";
import { cn } from "@/lib/utils";
import { SaveKeywordFieldDialog } from "./SaveKeywordFieldDialog";
import { useKeywordFieldSave } from "./useKeywordFieldSave";

function KeywordFieldUsage({
  field,
  countId,
}: {
  field: KeywordFieldDraft;
  countId: string;
}) {
  const t = useTranslations("localizations");
  const over = field.over > 0;
  return (
    <>
      <div className="flex items-center justify-between gap-3 text-caption">
        <span className="text-muted-foreground">{t("editor.separate")}</span>
        <span
          id={countId}
          aria-live="polite"
          className={cn(
            "numeric",
            over ? "font-medium text-signal-down" : "text-muted-foreground",
          )}
        >
          {`${field.used}/${KEYWORD_FIELD_CHAR_LIMIT}${
            over ? ` · ${t("editor.overLimit", { count: field.over })}` : ""
          }`}
        </span>
      </div>
      {field.storedAs === null ? null : (
        <p className="text-caption text-muted-foreground">
          {t("editor.storedAs")}
          <span className="font-mono break-all">{field.storedAs}</span>
        </p>
      )}
    </>
  );
}

function StoreFieldNotice({ sync }: { sync: AppLocalizationStoreSync | null }) {
  const t = useTranslations("localizations");
  const locale = useAppLocale();
  return (
    <>
      <p className="text-caption text-muted-foreground">
        {t("editor.imported")}
        {sync?.at ? (
          <>
            {" "}
            ·{" "}
            {t("editor.lastRead", {
              date: formatDateTimeInLocale(sync.at, locale),
            })}
          </>
        ) : (
          <> · {t("editor.waiting")}</>
        )}
        {t("editor.notice")}
        <Link
          href={STORE_CONNECTIONS_PATH}
          className="font-medium text-foreground link-underline"
        >
          {t("integrations")}
        </Link>
        .
      </p>
      {sync?.error ? (
        <p role="alert" className="text-dense text-destructive">
          {t("editor.importStopped", { error: sync.error })}
        </p>
      ) : null}
    </>
  );
}

export function KeywordFieldEditor({
  id,
  item,
  managed = false,
  sync = null,
  leading,
  proposed = null,
  onProposalSettled,
}: {
  id: string;
  item: AppLocalizationItem;
  managed?: boolean;
  sync?: AppLocalizationStoreSync | null;
  leading?: ReactNode;
  proposed?: readonly string[] | null;
  onProposalSettled?: () => void;
}) {
  const t = useTranslations("localizations");
  const locale = useAppLocale();
  const countId = useId();
  const editor = useRef<HTMLTextAreaElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const name = localizationNameInLocale(item.localization, locale);
  const [draft, setDraft] = useState<string | null>(() =>
    proposalDraft(item.phrases, proposed),
  );
  const stored = item.phrases.join(",");
  const text = managed ? stored : (draft ?? stored);
  const field = keywordFieldDraft(text, item.phrases);
  const over = field.over > 0;
  const {
    checking,
    saving,
    review,
    error,
    clearError,
    request,
    confirm,
    dismiss,
  } = useKeywordFieldSave(id, item, () => {
    setDraft(null);
    onProposalSettled?.();
  });
  const busy = checking || saving;

  return (
    <div className="flex flex-col gap-3">
      {managed ? <StoreFieldNotice sync={sync} /> : null}
      <Textarea
        ref={editor}
        value={text}
        onChange={(event) => {
          setDraft(event.target.value);
          clearError();
        }}
        readOnly={managed || busy}
        rows={3}
        spellCheck={false}
        dir="auto"
        aria-label={t("editor.fieldAria", { name })}
        aria-describedby={countId}
        aria-invalid={managed ? undefined : over}
        className="bg-card"
        placeholder={managed ? undefined : "fitness,workout,running,cardio"}
      />
      <KeywordFieldUsage field={field} countId={countId} />
      {item.readBy.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          {t("editor.noneReads", {
            name,
            markets: formatListInLocale(
              readingStorefrontNames(item.localization, locale),
              locale,
            ),
          })}
        </p>
      ) : null}
      {managed ? null : (
        <>
          {error && review === null ? (
            <p role="alert" className="text-dense text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>{leading}</div>
            <Button
              ref={saveButton}
              disabled={over || (!field.changed && field.phrases.length === 0)}
              aria-disabled={busy || undefined}
              onClick={() => {
                if (!busy) request(text);
              }}
            >
              {busy ? <Loader2 className="animate-spin" /> : null}
              {busy ? t("editor.saving") : t("editor.save")}
            </Button>
          </div>
          {review ? (
            <SaveKeywordFieldDialog
              preview={review}
              pending={saving}
              error={error}
              onConfirm={confirm}
              onClose={dismiss}
              returnFocus={() =>
                (saveButton.current?.disabled
                  ? editor.current
                  : saveButton.current
                )?.focus()
              }
            />
          ) : null}
        </>
      )}
    </div>
  );
}
