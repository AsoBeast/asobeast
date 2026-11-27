import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ActionItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCountryInLocale, storeLabel } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  actionCategoryLabel,
  actionRuleLabel,
  actionStatusLabel,
} from "./action-copy";
import { actionHeadline } from "./action-headline";
import { actionHref, actionSection } from "./action-links";
import { ActionStateControls } from "./ActionStateControls";
import { StatusIcon } from "./ActionStatusIcon";
import { PriorityWord } from "./PriorityWord";

export function ActionDetailHeader({ item }: { item: ActionItem }) {
  const t = useTranslations("actions");
  const locale = useAppLocale();
  const href = actionHref(item);

  return (
    <SheetHeader className="gap-3 border-b p-4 pr-12">
      <div className="flex flex-wrap items-center gap-2">
        <PriorityWord priority={item.priority} />
        <Badge variant="secondary">
          {actionCategoryLabel(item.category, t)}
        </Badge>
        <Badge variant="outline">
          <StatusIcon status={item.status} />
          <span>{actionStatusLabel(item.status, t)}</span>
        </Badge>
      </div>
      <SheetTitle className="text-balance">
        {actionHeadline(item, t, locale)}
      </SheetTitle>
      <SheetDescription>
        {actionRuleLabel(item.rule, t)} · {item.scope.appName ?? t("anApp")} ·{" "}
        {storeLabel(item.scope.store)} ·{" "}
        {formatCountryInLocale(item.scope.country, locale)}
      </SheetDescription>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <Link href={href}>
            {t("fixItIn", { section: actionSection(href, t) })}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
        <ActionStateControls item={item} />
      </div>
    </SheetHeader>
  );
}
