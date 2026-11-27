"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export interface StageRowProps {
  label: string;
  ready: boolean;
  progress: string | null;
  detail: string;
  states?: { ready: string; waiting: string };
}

export function StageRow({
  label,
  ready,
  progress,
  detail,
  states,
}: StageRowProps) {
  const t = useTranslations("jobs");
  const Icon = ready ? CheckCircle2 : LoaderCircle;
  const state = states ?? {
    ready: t("progress.states.ready"),
    waiting: t("progress.states.waiting"),
  };

  return (
    <li className="flex items-start gap-3">
      <Icon
        aria-hidden="true"
        className={
          ready
            ? "mt-0.5 size-4 shrink-0 text-muted-foreground"
            : "mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground"
        }
      />
      <div className="flex flex-col gap-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2 text-dense font-medium">
          <span>{label}</span>
          <span className="text-caption font-normal text-muted-foreground">
            {`${ready ? state.ready : state.waiting}${progress ? ` · ${progress}` : ""}`}
          </span>
        </p>
        <p className="text-dense text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}
