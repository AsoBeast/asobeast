"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, TriangleAlert } from "lucide-react";
import {
  runStatusOptions,
  storeHealthOptions,
  workspaceDeletionOptions,
} from "@/lib/queries";
import { NOTICE_LINK, NoticeLine } from "./notice-line";
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
    <NoticeLine
      icon={breakage ? TriangleAlert : Clock}
      tone={breakage ? "critical" : "warning"}
      role={breakage ? "alert" : "status"}
      data-slot="system-notice"
      className="mb-4 rounded-lg border px-3 py-2.5"
    >
      <p className="font-medium">{notice.title}</p>
      <p className="max-w-[110ch] text-muted-foreground">
        <span>{notice.detail}</span>
        {notice.href ? (
          <>
            {" "}
            <a
              href={notice.href}
              {...(internal ? {} : { target: "_blank", rel: "noreferrer" })}
              className={NOTICE_LINK}
            >
              {notice.linkLabel}
            </a>
          </>
        ) : null}
      </p>
    </NoticeLine>
  );
}
