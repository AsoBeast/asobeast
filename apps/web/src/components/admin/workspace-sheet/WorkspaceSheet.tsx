"use client";

import { useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { SupportWorkspaceDetail } from "@asobeast/shared";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotFound } from "@/lib/api";
import { adminWorkspaceOptions } from "@/lib/queries";
import { workspaceCloseTarget } from "./close-target";
import { standingOf } from "./workspace-facts";
import { WorkspaceAccessLog } from "./WorkspaceAccessLog";
import { WorkspaceActions } from "./WorkspaceActions";
import { WorkspaceChecks } from "./WorkspaceChecks";
import { WorkspaceFacts } from "./WorkspaceFacts";
import { WorkspaceFailedJobs } from "./WorkspaceFailedJobs";
import { WorkspaceLimits } from "./WorkspaceLimits";

type WorkspaceRead = UseQueryResult<SupportWorkspaceDetail>;

const SHEET_GUTTER = "px-4 pt-4 pr-12 pb-4";

function SheetSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-6 w-full" />
      ))}
    </div>
  );
}

function PendingBody({
  read,
  onClose,
}: {
  read: WorkspaceRead;
  onClose: () => void;
}) {
  if (isNotFound(read.error)) {
    return (
      <div className="flex flex-col items-start gap-3 px-4 py-4 text-dense">
        <p>This workspace no longer exists.</p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }
  if (failedRead(read)) {
    return (
      <div className="px-4 py-4">
        <InlineQueryError
          message="Could not read this workspace."
          read={read}
        />
      </div>
    );
  }
  if (read.fetchStatus === "paused") {
    return (
      <p role="status" className="px-4 py-4 text-dense text-muted-foreground">
        You are offline. The details load when the connection is back.
      </p>
    );
  }
  return <SheetSkeleton />;
}

function WorkspaceDetails({
  workspace,
  billing,
}: {
  workspace: SupportWorkspaceDetail;
  billing: boolean;
}) {
  return (
    <>
      <SheetHeader className={SHEET_GUTTER}>
        <SheetTitle dir="auto" className="wrap-anywhere">
          {workspace.name}
        </SheetTitle>
        <SheetDescription className="flex flex-wrap gap-x-1">
          <span translate="no" className="wrap-anywhere">
            {workspace.workspaceId}
          </span>
          <span>{`· ${standingOf(workspace)}`}</span>
        </SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-6">
        <WorkspaceFacts workspace={workspace} />
        <WorkspaceLimits workspace={workspace} />
        <WorkspaceChecks days={workspace.runHistory} />
        <WorkspaceFailedJobs jobs={workspace.failedJobs} />
        <WorkspaceAccessLog entries={workspace.recentAccess} />
        <WorkspaceActions workspace={workspace} billing={billing} />
      </div>
    </>
  );
}

export function WorkspaceSheet({
  shownId,
  billing,
  onClose,
}: {
  shownId: string;
  billing: boolean;
  onClose: () => void;
}) {
  const [lastId, setLastId] = useState(shownId);
  if (shownId !== "" && shownId !== lastId) setLastId(shownId);
  const open = shownId !== "";
  const read = useQuery({
    ...adminWorkspaceOptions(lastId),
    enabled: open && lastId !== "",
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          const target = workspaceCloseTarget(document, lastId);
          if (!target) return;
          event.preventDefault();
          target.focus();
        }}
      >
        {read.data ? (
          <WorkspaceDetails workspace={read.data} billing={billing} />
        ) : (
          <>
            <SheetHeader className={SHEET_GUTTER}>
              <SheetTitle>Workspace</SheetTitle>
              <SheetDescription>
                The support details of one workspace.
              </SheetDescription>
            </SheetHeader>
            <PendingBody read={read} onClose={onClose} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
