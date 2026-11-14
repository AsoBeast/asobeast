"use client";

import { Fragment, type ReactNode } from "react";
import { Clock, Loader2, MailCheck, MailX, Send } from "lucide-react";
import type { WebhookEvent } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  eventBadgeLabel,
  type AlertSubscriptionChange,
} from "../alert-event-copy";
import { CONFIRM_DROPS_BADGE } from "../ConfirmDropsField";
import { DeliveriesSection } from "../DeliveriesSection";
import { DeleteChannelDialog } from "./DeleteChannelDialog";
import { EditEventsDialog } from "./EditEventsDialog";
import {
  ESSENTIAL_ALERTS_BADGE,
  ESSENTIAL_ALERTS_LINE,
} from "../essential-alerts-copy";

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
        Resend confirmation
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
      Send test
    </Button>
  );
}

function ConfirmationNotice({ awaiting }: { awaiting?: AwaitingConfirmation }) {
  if (!awaiting) return null;
  const [Icon, title, detail] = awaiting.unsubscribed
    ? [
        MailX,
        "Unsubscribed.",
        "The recipient asked not to receive these alerts, so they are not asked to confirm again.",
      ]
    : [
        Clock,
        "Awaiting confirmation.",
        "No alerts are sent until the recipient follows the link in the email.",
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
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {essential ? (
        <Badge variant="info">{ESSENTIAL_ALERTS_BADGE}</Badge>
      ) : null}
      <p className="min-w-0 text-caption text-muted-foreground">
        {facts.map((fact) => (
          <Fragment key={fact}>
            <span>{fact}</span>
            <span> · </span>
          </Fragment>
        ))}
        {confirmDrops ? (
          <>
            <span data-slot="alert-rule">{CONFIRM_DROPS_BADGE}</span>
            <span> · </span>
          </>
        ) : null}
        {rules.length > 0 ? <span>Sends </span> : <span>Sends nothing</span>}
        {rules.map((rule, index) => (
          <Fragment key={rule.event}>
            {index > 0 ? <span>, </span> : null}
            <span data-slot="alert-rule">{rule.label}</span>
          </Fragment>
        ))}
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
            aria-label={`Toggle ${label}`}
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
          {ESSENTIAL_ALERTS_LINE}
        </p>
      ) : null}

      <ConfirmationNotice awaiting={awaiting} />

      <RuleLine
        essential={essential}
        facts={facts}
        confirmDrops={confirmDrops}
        rules={events.map((event) => ({
          event,
          label: eventBadgeLabel(event, reviewScores, {
            ratingDropTenths,
            rankDropThreshold,
          }),
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
