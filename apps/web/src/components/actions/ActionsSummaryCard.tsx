"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ACTION_PRIORITIES } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TOP_ACTION_LIMIT } from "@/lib/action-filters";
import { actionsOptions, actionSummaryOptions } from "@/lib/queries";
import { ACTION_PRIORITY_LABEL, ACTION_RULE_TITLE } from "./action-copy";
import { ActionPriorityBadge } from "./ActionPriorityBadge";

export function ActionsSummaryCard({ appId }: { appId?: string }) {
  const filters = { status: ["OPEN" as const], limit: TOP_ACTION_LIMIT };
  const { data: list } = useSuspenseQuery(actionsOptions(filters, appId));
  const { data: summary } = useSuspenseQuery(actionSummaryOptions);
  const href = appId ? `/apps/${appId}/actions` : "/actions";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top actions</CardTitle>
        <CardDescription>
          The highest-impact open work, computed from your stored data.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {ACTION_PRIORITIES.map((priority) => (
            <Badge key={priority} variant="outline">
              {summary.byPriority[priority]} {ACTION_PRIORITY_LABEL[priority]}
            </Badge>
          ))}
        </div>

        {list.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {summary.generatedAt === null
              ? "No actions generated yet."
              : "Nothing to do right now."}
          </p>
        ) : (
          <ul className="flex list-none flex-col gap-2 p-0">
            {list.items.slice(0, TOP_ACTION_LIMIT).map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-sm">
                <ActionPriorityBadge priority={item.priority} />
                <span>{ACTION_RULE_TITLE[item.rule]}</span>
              </li>
            ))}
          </ul>
        )}

        <Link
          href={href}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Open the Action Center
        </Link>
      </CardContent>
    </Card>
  );
}
