"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  runStatusOptions,
  storeHealthOptions,
  workspaceDeletionOptions,
} from "@/lib/queries";
import { systemNotice } from "./system-notice";

export function SystemBanner() {
  const { data: stores } = useQuery(storeHealthOptions);
  const { data: run } = useQuery(runStatusOptions);
  const { data: deletion } = useQuery(workspaceDeletionOptions);
  const notice = systemNotice({ stores, run, deletion });

  if (!notice) {
    return null;
  }

  const breakage = notice.variant === "destructive";
  const internal = notice.href?.startsWith("/") ?? false;

  return (
    <Alert
      variant={notice.variant}
      role={breakage ? "alert" : "status"}
      className="mb-4"
    >
      {breakage ? (
        <TriangleAlert aria-hidden="true" />
      ) : (
        <Clock aria-hidden="true" />
      )}
      <AlertTitle>{notice.title}</AlertTitle>
      <AlertDescription>
        {notice.detail}
        {notice.href ? (
          <>
            {" "}
            <a
              href={notice.href}
              {...(internal ? {} : { target: "_blank", rel: "noreferrer" })}
              className="font-medium underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {notice.linkLabel}
            </a>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
