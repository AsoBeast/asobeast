import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";

export function DelistedBadge({ since }: { since: string }) {
  const t = useTranslations("apps");
  const locale = useAppLocale();
  return (
    <Badge
      variant="warning"
      className="w-fit"
      title={t("delisted.title", { date: formatDateInLocale(since, locale) })}
    >
      {t("delisted.label")}
    </Badge>
  );
}
