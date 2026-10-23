"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SETTINGS_PATH } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiError, completePlaySignIn } from "@/lib/api";
import { invalidateStoreConnectionMutation } from "@/lib/queries";

const STORE_CONNECTIONS_PATH = `${SETTINGS_PATH}#store-connections`;

function ReturnCard({
  title,
  description,
  pending = false,
}: {
  title: string;
  description: string;
  pending?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h1>{title}</h1>
        </CardTitle>
        <CardDescription role={pending ? "status" : undefined}>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pending ? (
          <Loader2
            aria-hidden="true"
            className="animate-spin text-muted-foreground"
          />
        ) : (
          <Button asChild variant="outline">
            <Link href={STORE_CONNECTIONS_PATH}>Back to store connections</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function PlaySignInReturn() {
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
      toast.success("Google Play Console connected");
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
        title="Google sign in was cancelled"
        description="Nothing was connected. Start again from store connections when you are ready."
      />
    );
  }
  if (!ready) {
    return (
      <ReturnCard
        title="This sign in is incomplete"
        description="Google did not return the code AsoBeast needs. Start the sign in again from store connections."
      />
    );
  }
  if (isError) {
    return (
      <ReturnCard
        title="Google Play was not connected"
        description={
          error instanceof ApiError
            ? error.envelope.message
            : "Could not finish the Google sign in. Try again from store connections."
        }
      />
    );
  }
  return (
    <ReturnCard
      title="Connecting Google Play"
      description="Checking the bucket with your Google account."
      pending
    />
  );
}
