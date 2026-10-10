"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { SETTINGS_PATH } from "@asobeast/shared";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError, unsubscribeEmailAlert } from "@/lib/api";

const ALERT_SETTINGS = `${SETTINGS_PATH}#email-alerts`;
const INVALID_STATUSES = [400, 404];

interface UnsubscribeCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

function UnsubscribeCard({
  title,
  description,
  children,
}: UnsubscribeCardProps) {
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

function SettingsLink({ children }: { children: ReactNode }) {
  return (
    <Button asChild variant="outline">
      <Link href={ALERT_SETTINGS}>{children}</Link>
    </Button>
  );
}

function isInvalidLink(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    INVALID_STATUSES.includes(error.envelope.statusCode)
  );
}

export function UnsubscribeContent() {
  const params = useSearchParams();
  const alert = params.get("alert") ?? "";
  const token = params.get("token") ?? "";
  const mutation = useMutation({
    mutationFn: () => unsubscribeEmailAlert(alert, token),
  });

  if (alert === "" || token === "") {
    return (
      <UnsubscribeCard
        title="Unsubscribe link incomplete"
        description="Open the link from your alert email."
      >
        <SettingsLink>Manage alerts in Settings</SettingsLink>
      </UnsubscribeCard>
    );
  }

  if (mutation.isSuccess) {
    return (
      <UnsubscribeCard
        title="You are unsubscribed"
        description="This address will not receive these alerts any more."
      >
        <SettingsLink>Open settings</SettingsLink>
      </UnsubscribeCard>
    );
  }

  if (mutation.isError && isInvalidLink(mutation.error)) {
    return (
      <UnsubscribeCard
        title="This unsubscribe link is not valid"
        description="The alert may have been deleted or moved to another address. Manage alerts in Settings instead."
      >
        <SettingsLink>Manage alerts in Settings</SettingsLink>
      </UnsubscribeCard>
    );
  }

  return (
    <UnsubscribeCard
      title={mutation.isError ? "Could not unsubscribe" : "Stop email alerts?"}
      description={
        mutation.isError
          ? "Try again in a moment."
          : "This address will stop receiving this AsoBeast email alert. You can turn it back on in Settings at any time."
      }
    >
      <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
        Unsubscribe
      </Button>
    </UnsubscribeCard>
  );
}
