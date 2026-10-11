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

const ALERT_SETTINGS = `${SETTINGS_PATH}#email-alerts`;

interface AlertLinkCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AlertLinkCard({
  title,
  description,
  children,
}: AlertLinkCardProps) {
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle asChild>
          <h1>{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

export function AlertSettingsLink({ children }: { children: ReactNode }) {
  return (
    <Button asChild variant="outline">
      <Link href={ALERT_SETTINGS}>{children}</Link>
    </Button>
  );
}

export function hasStatus(error: unknown, statuses: number[]): boolean {
  return (
    error instanceof ApiError && statuses.includes(error.envelope.statusCode)
  );
}
