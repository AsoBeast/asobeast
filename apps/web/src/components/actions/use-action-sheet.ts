"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { createSerializer, useQueryState } from "nuqs";
import { actionFocusParser, actionQueueParsers } from "@/lib/search-params";
import type { QueueViewState } from "./use-queue-view";

const serialize = createSerializer({
  ...actionQueueParsers,
  action: actionFocusParser,
});

export function useActionSheet(view: QueueViewState) {
  const pathname = usePathname();
  const [id, setId] = useQueryState("action", actionFocusParser);
  const pushed = useRef(false);

  return {
    id,
    hrefFor: (actionId: string) =>
      `${pathname}${serialize({ ...view, action: actionId })}`,
    open: (actionId: string) => {
      pushed.current = true;
      void setId(actionId, { history: "push" });
    },
    close: () => {
      if (pushed.current) {
        pushed.current = false;
        window.history.back();
        return;
      }
      void setId(null, { history: "replace" });
    },
  };
}
