"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recoveryFor } from "@/lib/error-recovery";
import { webHealthOptions } from "@/lib/queries";

export function ErrorState({
  error,
  retry,
  title,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  title?: string;
}) {
  const recovery = recoveryFor(error);
  const statusPage = useQuery(webHealthOptions).data?.statusPageUrl ?? null;

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center"
    >
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title ?? recovery.title}</p>
        <p className="max-w-md text-body text-muted-foreground">
          {recovery.body}
        </p>
      </div>
      {recovery.action.kind === "retry" ? (
        <Button variant="outline" onClick={retry}>
          <RotateCw />
          Try again
        </Button>
      ) : (
        <Button asChild variant="outline">
          <Link href={recovery.action.href}>{recovery.action.label}</Link>
        </Button>
      )}
      {statusPage ? (
        <p className="text-caption text-muted-foreground">
          If this keeps happening,{" "}
          <a
            href={statusPage}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline"
          >
            check the status page
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
