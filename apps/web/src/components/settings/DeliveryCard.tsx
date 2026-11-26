"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import type { AlertFlushResult } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
import { Button } from "@/components/ui/button";
import { flushAlerts } from "@/lib/api";
import { formatDateTimeInLocale } from "@/lib/format";
import { alertDeliveryKey, alertDeliveryOptions } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { useAppLocale } from "@/lib/use-app-locale";
import { PanelBody, SettingsPanel } from "./SettingsPanel";

function Field({
  label,
  inline = false,
  children,
}: {
  label: string;
  inline?: boolean;
  children: React.ReactNode;
}) {
  const id = `delivery-field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div
      role="group"
      aria-labelledby={id}
      className={inline ? "flex items-baseline gap-1" : "contents"}
    >
      <span id={id} className={inline ? undefined : "text-muted-foreground"}>
        {label}
      </span>
      <span
        className={inline ? "numeric font-medium text-foreground" : "min-w-0"}
      >
        {children}
      </span>
    </div>
  );
}

export function flushMessage(
  result: AlertFlushResult,
  translator: MessageTranslator,
): string {
  if (result.flushed === 0) return translator("delivery.nothingToFlush");
  return translator("delivery.flushed", {
    notifications: result.notifications,
    channels: result.channels,
    flushed: result.flushed,
  });
}

export function DeliveryCard() {
  const t = useTranslations("notifications");
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(alertDeliveryOptions);

  const flush = useMutation({
    mutationFn: flushAlerts,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: alertDeliveryKey });
      toast.success(flushMessage(result, t));
    },
    onError: () => toast.error(t("delivery.flushError")),
  });
  const flushOnce = useSingleFlight(flush);

  return (
    <SettingsPanel
      title={t("delivery.title")}
      action={
        <Button
          variant="outline"
          size="sm"
          aria-disabled={flush.isPending || undefined}
          aria-busy={flush.isPending}
          onClick={() => flushOnce()}
        >
          {flush.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          {t("delivery.flushNow")}
        </Button>
      }
      footer={
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Field inline label={t("delivery.lastFlush")}>
            {data.lastFlushAt
              ? formatDateTimeInLocale(data.lastFlushAt, locale)
              : t("delivery.never")}
          </Field>
          <Field inline label={t("delivery.pending")}>
            {data.pending}
          </Field>
          <Field inline label={t("delivery.claimed")}>
            {data.claimed}
          </Field>
        </div>
      }
    >
      <PanelBody>
        <p className="max-w-[70ch] text-body text-muted-foreground">
          {t(
            data.mode === "batched"
              ? "delivery.batchedDescription"
              : "delivery.instantDescription",
          )}
        </p>
        <div className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-dense">
          <Field label={t("delivery.mode")}>
            {t(
              data.mode === "batched" ? "delivery.batched" : "delivery.instant",
            )}
          </Field>
          <Field label={t("delivery.trigger")}>
            {t("delivery.afterCompletion")}
          </Field>
          <Field label={t("delivery.pipelineStarts")}>
            <code translate="no" className="font-mono text-caption">
              {data.pipelineCron}
            </code>
          </Field>
        </div>
      </PanelBody>
    </SettingsPanel>
  );
}
