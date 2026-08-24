"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { runStatusOptions } from "@/lib/queries";
import { runDelayNotice } from "./run-delay-notice";

export function RunDelayBanner() {
  const { data } = useQuery(runStatusOptions);
  const notice = data ? runDelayNotice(data) : null;

  if (!notice) {
    return null;
  }

  return (
    <Alert variant="warning" className="mb-4">
      <Clock aria-hidden="true" />
      <AlertTitle>{notice.title}</AlertTitle>
      <AlertDescription>{notice.detail}</AlertDescription>
    </Alert>
  );
}
