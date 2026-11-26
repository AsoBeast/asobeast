"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useQuery,
  useQueryClient,
  useQueryErrorResetBoundary,
} from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { recoveryFor, type RecoveryScope } from "@/lib/error-recovery";
import { reportBrowserError, worthReporting } from "@/lib/error-reporting";
import { oncePerError } from "@/lib/once-per-error";
import { refetchFailedQueries, webHealthOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useAppLocale } from "@/lib/use-app-locale";

const LAYOUT = {
  panel: {
    root: "items-start gap-4 rounded-lg border border-border bg-card p-6 text-left",
    text: "gap-1",
    title: "font-medium",
    body: "max-w-prose",
  },
  page: {
    root: "w-full items-center gap-6 text-center text-balance",
    text: "gap-2",
    title: "text-title",
    body: "",
  },
} as const;

export function ErrorState({
  error,
  retry,
  title,
  scope,
  layout = "panel",
  className,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  title?: string;
  scope?: RecoveryScope;
  layout?: keyof typeof LAYOUT;
  className?: string;
}) {
  const classes = LAYOUT[layout];
  const locale = useAppLocale();
  const t = useTranslations("errors");
  const common = useTranslations("common");
  const Title = layout === "page" ? "h1" : "p";
  const recovery = recoveryFor(error, scope, { translator: t, locale });
  const statusPage = useQuery(webHealthOptions).data?.statusPageUrl ?? null;
  const queryClient = useQueryClient();
  const queryErrors = useQueryErrorResetBoundary();
  const [once] = useState(oncePerError);
  const tryAgain = () =>
    once(error, () => {
      queryErrors.reset();
      void refetchFailedQueries(queryClient);
      retry();
    });

  useEffect(() => {
    if (worthReporting(error)) void reportBrowserError(error);
  }, [error]);

  return (
    <div
      role="alert"
      data-slot="error-state"
      className={cn("flex flex-col", classes.root, className)}
    >
      <div className={cn("flex flex-col", classes.text)}>
        <Title className={classes.title}>{title ?? recovery.title}</Title>
        <p className={cn("text-body text-muted-foreground", classes.body)}>
          {recovery.body}
        </p>
      </div>
      {recovery.action.kind === "retry" ? (
        <Button data-action="retry" variant="outline" onClick={tryAgain}>
          <RotateCw />
          {common("retry")}
        </Button>
      ) : (
        <Button asChild variant="outline">
          <Link href={recovery.action.href}>{recovery.action.label}</Link>
        </Button>
      )}
      {statusPage ? (
        <p className="text-caption text-muted-foreground">
          {t.rich("statusPage", {
            link: (chunks) => (
              <a
                href={statusPage}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground link-underline"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      ) : null}
    </div>
  );
}
