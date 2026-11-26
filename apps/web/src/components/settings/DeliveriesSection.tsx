"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, Loader2, XCircle } from "lucide-react";
import type { AlertDeliveryItem } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
import { Button } from "@/components/ui/button";
import { Separated } from "@/components/ui/separated";
import { getDeliveries } from "@/lib/api";
import { formatDateTimeInLocale } from "@/lib/format";
import { deliveryKeys } from "@/lib/queries";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";
import { eventLabel } from "./alert-event-copy";

const delivered = (delivery: AlertDeliveryItem) =>
  delivery.status === "success";

export function deliveryStatusLabel(
  success: boolean,
  translator: MessageTranslator,
): string {
  return translator(success ? "deliveries.success" : "deliveries.failed");
}

function DeliveryStatus({ delivery }: { delivery: AlertDeliveryItem }) {
  const t = useTranslations("notifications");
  const Icon = delivered(delivery) ? CheckCircle2 : XCircle;
  return (
    <span className="flex items-center gap-2 font-medium">
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0",
          delivered(delivery) ? "text-success" : "text-destructive",
        )}
      />
      <span>{deliveryStatusLabel(delivered(delivery), t)}</span>
    </span>
  );
}

function DeliveryRow({ delivery }: { delivery: AlertDeliveryItem }) {
  const t = useTranslations("notifications");
  const locale = useAppLocale();
  return (
    <li className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-t border-border-subtle py-2 text-dense sm:grid-cols-[max-content_minmax(0,1fr)_max-content]">
      <DeliveryStatus delivery={delivery} />
      <span className="min-w-0 text-muted-foreground wrap-anywhere">
        <Separated
          parts={[
            eventLabel(delivery.event, t),
            t("deliveries.attempt", { count: delivery.attempt }),
            ...(delivery.detail ? [delivery.detail] : []),
          ]}
        />
      </span>
      <time
        dateTime={delivery.createdAt}
        className="col-span-full text-caption text-faint-foreground sm:col-span-1"
      >
        {formatDateTimeInLocale(delivery.createdAt, locale)}
      </time>
    </li>
  );
}

function DeliverySummary({ deliveries }: { deliveries: AlertDeliveryItem[] }) {
  const t = useTranslations("notifications");
  const sent = deliveries.filter(delivered).length;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-2">
      <div className="flex items-center gap-3">
        <span className="text-label">
          {t("deliveries.last", { count: deliveries.length })}
        </span>
        <span aria-hidden className="flex h-4 items-center gap-px">
          {deliveries.toReversed().map((delivery) => (
            <span
              key={delivery.id}
              className={cn(
                "w-1 rounded-xs",
                delivered(delivery) ? "h-4 bg-success" : "h-2 bg-destructive",
              )}
            />
          ))}
        </span>
      </div>
      <span className="numeric text-caption text-faint-foreground">
        {t("deliveries.summary", { sent, total: deliveries.length })}
      </span>
    </div>
  );
}

export function DeliveriesSection({
  channel,
  id,
}: {
  channel: "webhook" | "email";
  id: string;
}) {
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: deliveryKeys.list(channel, id),
    queryFn: () =>
      getDeliveries(
        channel === "webhook" ? { webhookId: id } : { emailAlertId: id },
      ),
    enabled: open,
  });

  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronRight
          className={cn(
            "transition-transform duration-150 motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
        {t("deliveries.recent")}
      </Button>

      {open ? (
        <div className="basis-full pt-1 pl-2">
          {isLoading ? (
            <p className="flex items-center gap-2 py-2 text-caption text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>{t("deliveries.loading")}</span>
            </p>
          ) : data && data.length > 0 ? (
            <>
              <DeliverySummary deliveries={data} />
              <ul>
                {data.map((delivery) => (
                  <DeliveryRow key={delivery.id} delivery={delivery} />
                ))}
              </ul>
            </>
          ) : (
            <p className="py-2 text-caption text-muted-foreground">
              {t("deliveries.none")}
            </p>
          )}
        </div>
      ) : null}
    </>
  );
}
