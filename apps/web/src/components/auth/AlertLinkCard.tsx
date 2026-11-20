"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SETTINGS_PATH } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useFocusClaim } from "@/lib/focus-handoff";
import { AuthActions, AuthCard } from "./AuthCard";
import { useAnswerFocus } from "./use-answer-focus";
import { useAuth } from "./use-auth";

const ALERT_SETTINGS = `${SETTINGS_PATH}#email-alerts`;

export const INVALID_LINK_STATUSES = [400, 404];

const RESULT_FOCUS_KEY = "alert-link-result";

export const useResultFocus = () => useAnswerFocus(RESULT_FOCUS_KEY);

interface AlertLinkCardProps {
  title: string;
  description: string;
  settingsLink?: string;
  children?: ReactNode;
}

export function AlertLinkCard({
  title,
  description,
  settingsLink,
  children,
}: AlertLinkCardProps) {
  const { authenticated } = useAuth();
  const claimFocus = useFocusClaim(RESULT_FOCUS_KEY);
  const action =
    children ??
    (settingsLink && authenticated ? (
      <Button asChild variant="outline">
        <Link href={ALERT_SETTINGS}>{settingsLink}</Link>
      </Button>
    ) : null);

  return (
    <AuthCard title={title} titleRef={claimFocus} description={description}>
      {action ? <AuthActions>{action}</AuthActions> : null}
    </AuthCard>
  );
}

export function hasStatus(error: unknown, statuses: number[]): boolean {
  return (
    error instanceof ApiError && statuses.includes(error.envelope.statusCode)
  );
}
