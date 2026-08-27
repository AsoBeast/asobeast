"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { webHealthOptions } from "@/lib/queries";
import { reportingOptions } from "@/lib/sentry";

export function ErrorReporter() {
  const dsn = useQuery(webHealthOptions).data?.errorReportingDsn ?? null;

  useEffect(() => {
    if (!dsn) return;
    void import("@sentry/nextjs").then((Sentry) => {
      if (!Sentry.isInitialized()) Sentry.init(reportingOptions(dsn));
    });
  }, [dsn]);

  return null;
}
