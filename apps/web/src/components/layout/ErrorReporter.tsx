"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useQuery } from "@tanstack/react-query";
import { webHealthOptions } from "@/lib/queries";
import { reportingOptions } from "@/lib/sentry";

export function ErrorReporter() {
  const dsn = useQuery(webHealthOptions).data?.errorReportingDsn ?? null;

  useEffect(() => {
    if (!dsn || Sentry.isInitialized()) return;
    Sentry.init(reportingOptions(dsn));
  }, [dsn]);

  return null;
}
