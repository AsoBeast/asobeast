"use client";

import { Fragment, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Clock, Loader2, MailCheck, MailX, Send } from "lucide-react";
import type { WebhookEvent } from "@asobeast/shared";
import type { TranslationContext } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  eventBadgeLabel,
  type AlertSubscriptionChange,
} from "../alert-event-copy";
import { DeliveriesSection } from "../DeliveriesSection";
import { DeleteChannelDialog } from "./DeleteChannelDialog";
import { EditEventsDialog } from "./EditEventsDialog";

export interface AwaitingConfirmation {
  pending: boolean;
  onResend: () => void;
  unsubscribed: boolean;
}

function RowAction({
  awaiting,
  testPending,
  onTest,
}: {
  awaiting?: AwaitingConfirmation;
  testPending: boolean;
  onTest: () => void;
}) {
  const t = useTranslations("notifications");
  if (awaiting?.unsubscribed) return null;
  if (awaiting) {
    return (
      <Button
        variant="outline"
        size="sm"
        aria-disabled={awaiting.pending || undefined}
        onClick={awaiting.onResend}
      >
        {awaiting.pending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <MailCheck />
        )}
        {t("confirmation.resend")}
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      aria-disabled={testPending || undefined}
      onClick={onTest}
    >
      {testPending ? <Loader2 className="animate-spin" /> : <Send />}
      {t("confirmation.sendTest")}
    </Button>
  );
}

function ConfirmationNotice({ awaiting }: { awaiting?: AwaitingConfirmation }) {
  const t = useTranslations("notifications");
  if (!awaiting) return null;
  const [Icon, title, detail] = awaiting.unsubscribed
    ? [
        MailX,
        t("confirmation.unsubscribedTitle"),
        t("confirmation.unsubscribedDetail"),
      ]
    : [
        Clock,
        t("confirmation.awaitingTitle"),
        t("confirmation.awaitingDetail"),
      ];
  return (
    <p className="flex items-start gap-2 text-caption text-muted-foreground">
      <Icon className="mt-px size-4 shrink-0" aria-hidden />
      <span>
        <strong className="font-medium text-foreground">{title}</strong>{" "}
        {detail}
      </span>
    </p>
  );
}

interface Rule {
  event: WebhookEvent;
  label: string;
}

function RuleLabels({
  rules,
  locale,
}: {
  rules: readonly Rule[];
  locale: Locale;
}) {
  const parts = new Intl.ListFormat(locale, {
    type: "conjunction",
  }).formatToParts(rules.map((rule) => rule.label));
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "element") {
          const ruleIndex = parts
            .slice(0, index)
            .filter((candidate) => candidate.type === "element").length;
          const rule = rules[ruleIndex];
          return (
            <span key={rule.event} data-slot="alert-rule">
              {rule.label}
            </span>
          );
        }
        return <span key={`${part.type}-${index}`}>{part.value}</span>;
      })}
    </>
  );
}

function RuleLine({
  essential,
  facts,
  confirmDrops,
  rules,
}: {
  essential: boolean;
  facts: readonly string[];
  confirmDrops: boolean;
  rules: readonly Rule[];
}) {
  const t = useTranslations("notifications");
  const locale = useAppLocale();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {essential ? <Badge variant="info">{t("essential.badge")}</Badge> : null}
      <p className="min-w-0 text-caption text-muted-foreground">
        {facts.map((fact) => (
          <Fragment key={fact}>
            <span>{fact}</span>
            <span> · </span>
          </Fragment>
        ))}
        {confirmDrops ? (
          <>
            <span data-slot="alert-rule">{t("confirmDrops.badge")}</span>
            <span> · </span>
          </>
        ) : null}
        {rules.length > 0 ? (
          <>
            <span>{t("rules.sendsPrefix")}</span>
            <RuleLabels rules={rules} locale={locale} />
          </>
        ) : (
          <span>{t("rules.sendsNothing")}</span>
        )}
      </p>
    </div>
  );
}

export function AlertChannelRow({
  label,
  channel,
  id,
  events,
  confirmDrops,
  reviewScores,
  ratingDropTenths,
  rankDropThreshold,
  essential = false,
  facts = [],
  awaiting,
  active,
  activePending,
  onActiveChange,
  confirmTitle,
  confirmDescription,
  testPending,
  onTest,
  deletePending,
  onDelete,
  eventsPending,
  onEventsSave,
}: {
  label: string;
  channel: "webhook" | "email";
  id: string;
  events: WebhookEvent[];
  confirmDrops: boolean;
  reviewScores?: number[];
  ratingDropTenths?: number;
  rankDropThreshold?: number | null;
  essential?: boolean;
  facts?: readonly string[];
  awaiting?: AwaitingConfirmation;
  active: boolean;
  activePending: boolean;
  onActiveChange: (active: boolean) => void;
  confirmTitle: string;
  confirmDescription: ReactNode;
  testPending: boolean;
  onTest: () => void;
  deletePending: boolean;
  onDelete: () => Promise<unknown>;
  eventsPending: boolean;
  onEventsSave: (change: AlertSubscriptionChange) => Promise<unknown>;
}) {
  const t = useTranslations("notifications");
  const locale = useAppLocale();
  const context: TranslationContext = { translator: t, locale };
  return (
    <li className="flex flex-col gap-2 border-b border-border-subtle px-(--card-spacing) py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 basis-48 text-dense font-medium wrap-anywhere">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <Switch
            checked={active}
            aria-disabled={activePending || undefined}
            aria-label={t("rules.toggle", { label })}
            onCheckedChange={(next) => {
              if (!activePending) onActiveChange(next);
            }}
          />
          <RowAction
            awaiting={awaiting}
            testPending={testPending}
            onTest={onTest}
          />
          <DeleteChannelDialog
            label={label}
            title={confirmTitle}
            description={confirmDescription}
            pending={deletePending}
            onDelete={onDelete}
          />
        </div>
      </div>

      {essential ? (
        <p className="text-caption text-muted-foreground">
          {t("essential.line")}
        </p>
      ) : null}

      <ConfirmationNotice awaiting={awaiting} />

      <RuleLine
        essential={essential}
        facts={facts}
        confirmDrops={confirmDrops}
        rules={events.map((event) => ({
          event,
          label: eventBadgeLabel(
            event,
            reviewScores,
            {
              ratingDropTenths,
              rankDropThreshold,
            },
            context,
          ),
        }))}
      />

      <div className="-ml-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <EditEventsDialog
          label={label}
          events={events}
          confirmDrops={confirmDrops}
          reviewScores={reviewScores}
          ratingDropTenths={ratingDropTenths}
          rankDropThreshold={rankDropThreshold ?? null}
          pending={eventsPending}
          onSave={onEventsSave}
        />
        <DeliveriesSection channel={channel} id={id} />
      </div>
    </li>
  );
}
