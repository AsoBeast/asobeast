import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ActionItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCountry, storeLabel } from "@/lib/format";
import {
  ACTION_CATEGORY_LABEL,
  ACTION_RULE_TITLE,
  ACTION_STATUS_LABEL,
} from "./action-copy";
import { actionHeadline } from "./action-headline";
import { actionHref, actionSection } from "./action-links";
import { ActionPriorityBadge } from "./ActionPriorityBadge";
import { ActionStateControls } from "./ActionStateControls";
import { StatusIcon } from "./ActionStatusIcon";

export function ActionDetailHeader({ item }: { item: ActionItem }) {
  const href = actionHref(item);

  return (
    <SheetHeader className="gap-3 border-b p-4 pr-12">
      <div className="flex flex-wrap items-center gap-2">
        <ActionPriorityBadge priority={item.priority} />
        <Badge variant="secondary">
          {ACTION_CATEGORY_LABEL[item.category]}
        </Badge>
        <Badge variant="outline">
          <StatusIcon status={item.status} />
          {ACTION_STATUS_LABEL[item.status]}
        </Badge>
      </div>
      <SheetTitle className="text-title text-balance">
        {actionHeadline(item)}
      </SheetTitle>
      <SheetDescription>
        {ACTION_RULE_TITLE[item.rule]} · {item.scope.appName ?? "An app"} ·{" "}
        {storeLabel(item.scope.store)} · {formatCountry(item.scope.country)}
      </SheetDescription>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <Link href={href}>
            Fix it in {actionSection(href)}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
        <ActionStateControls item={item} />
      </div>
    </SheetHeader>
  );
}
