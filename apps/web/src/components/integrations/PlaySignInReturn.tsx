"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, completePlaySignIn } from "@/lib/api";
import { invalidateStoreConnectionMutation } from "@/lib/queries";
import { STORE_CONNECTIONS_PATH } from "@/lib/store-connection-copy";

function ReturnCard({
  title,
  description,
  pending = false,
}: {
  title: string;
  description: string;
  pending?: boolean;
}) {
  const t = useTranslations("integrations");
  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h1>{title}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4">
        <p
          role={pending ? "status" : undefined}
          className="max-w-[70ch] text-body text-muted-foreground"
        >
          {description}
        </p>
        {pending ? (
          <Loader2
            aria-hidden="true"
            className="animate-spin text-muted-foreground"
          />
        ) : (
          <Button asChild variant="outline">
            <Link href={STORE_CONNECTIONS_PATH}>{t("playSignIn.back")}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function PlaySignInReturn() {
  const t = useTranslations("integrations");
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const code = params.get("code") ?? "";
  const state = params.get("state") ?? "";
  const denied = params.get("error") !== null;
  const ready = !denied && code !== "" && state !== "";
  const started = useRef(false);
  const { mutate, isError, error } = useMutation({
    mutationFn: () => completePlaySignIn({ code, state }),
    onSuccess: () => {
      invalidateStoreConnectionMutation(queryClient);
      toast.success(t("playSignIn.connected"));
      router.replace(STORE_CONNECTIONS_PATH);
    },
  });

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    mutate();
  }, [ready, mutate]);

  if (denied) {
    return (
      <ReturnCard
        title={t("playSignIn.cancelledTitle")}
        description={t("playSignIn.cancelledBody")}
      />
    );
  }
  if (!ready) {
    return (
      <ReturnCard
        title={t("playSignIn.incompleteTitle")}
        description={t("playSignIn.incompleteBody")}
      />
    );
  }
  if (isError) {
    return (
      <ReturnCard
        title={t("playSignIn.failedTitle")}
        description={
          error instanceof ApiError
            ? error.envelope.message
            : t("playSignIn.failedBody")
        }
      />
    );
  }
  return (
    <ReturnCard
      title={t("playSignIn.connectingTitle")}
      description={t("playSignIn.connectingBody")}
      pending
    />
  );
}
