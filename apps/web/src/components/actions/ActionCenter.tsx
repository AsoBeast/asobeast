"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { ActionFilters as Filters } from "@/lib/api";
import { actionsOptions } from "@/lib/queries";
import {
  actionFocusParser,
  actionPriorityParser,
  actionRuleParser,
  actionStatusParser,
} from "@/lib/search-params";
import { ActionCard } from "./ActionCard";
import { ActionEmptyState } from "./ActionEmptyState";
import { ActionFilters } from "./ActionFilters";

export function ActionCenter({ appId }: { appId?: string }) {
  const [status, setStatus] = useQueryState("status", actionStatusParser);
  const [priority, setPriority] = useQueryState(
    "priority",
    actionPriorityParser,
  );
  const [rule, setRule] = useQueryState("rule", actionRuleParser);
  const [focus] = useQueryState("action", actionFocusParser);

  const filters = useMemo<Filters>(
    () => ({
      status,
      ...(priority.length > 0 ? { priority } : {}),
      ...(rule.length > 0 ? { rule } : {}),
    }),
    [status, priority, rule],
  );

  const { data } = useSuspenseQuery(actionsOptions(filters, appId));

  const focusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focus || focusRef.current === focus) return;
    const card = document.getElementById(`action-${focus}`);
    if (!card) return;
    focusRef.current = focus;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.querySelector("details")?.setAttribute("open", "true");
    card.setAttribute("tabindex", "-1");
    card.focus({ preventScroll: true });
  }, [focus, data]);

  const filtered =
    priority.length > 0 || rule.length > 0 || status.length !== 2;

  return (
    <div className="flex flex-col gap-6">
      <ActionFilters
        status={status}
        priority={priority}
        rule={rule}
        onStatusChange={(next) => void setStatus(next)}
        onPriorityChange={(next) => void setPriority(next)}
        onRuleChange={(next) => void setRule(next)}
      />

      {data.items.length === 0 ? (
        <ActionEmptyState
          generatedAt={data.generatedAt}
          filtered={filtered}
          onClearFilters={() => {
            void setStatus(null);
            void setPriority(null);
            void setRule(null);
          }}
        />
      ) : (
        <ul className="flex list-none flex-col gap-4 p-0">
          {data.items.map((item) => (
            <li key={item.id}>
              <ActionCard item={item} focused={focus === item.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
