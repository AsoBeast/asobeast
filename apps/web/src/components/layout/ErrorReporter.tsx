"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { startBrowserReporting } from "@/lib/error-reporting";
import { webHealthOptions } from "@/lib/queries";

export function ErrorReporter() {
  const dsn = useQuery(webHealthOptions).data?.errorReportingDsn ?? null;

  useEffect(() => {
    if (dsn) void startBrowserReporting(dsn).catch(() => undefined);
  }, [dsn]);

  return null;
}
