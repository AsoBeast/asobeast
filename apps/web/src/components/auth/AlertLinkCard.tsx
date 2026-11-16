"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SETTINGS_PATH } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { useAuth } from "./use-auth";

const ALERT_SETTINGS = `${SETTINGS_PATH}#email-alerts`;

export const INVALID_LINK_STATUSES = [400, 404];

const RESULT_FOCUS_KEY = "alert-link-result";

export const armResultFocus = () => armFocusHandoff(RESULT_FOCUS_KEY);

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
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle asChild>
          <h1 ref={claimFocus} tabIndex={-1} className="outline-none">
            {title}
          </h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {action ? (
        <CardContent className="flex flex-col gap-3">{action}</CardContent>
      ) : null}
    </Card>
  );
}

export function hasStatus(error: unknown, statuses: number[]): boolean {
  return (
    error instanceof ApiError && statuses.includes(error.envelope.statusCode)
  );
}
