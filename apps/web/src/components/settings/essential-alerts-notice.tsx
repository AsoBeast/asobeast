import { useTranslations } from "next-intl";
import type { EssentialAlertsNeed } from "@asobeast/shared";
import { essentialNeed } from "./essential-alerts-copy";

export function EssentialAlertsNotice({
  need,
}: {
  need: EssentialAlertsNeed | null | undefined;
}) {
  const t = useTranslations("notifications");
  const copy = essentialNeed(need);
  if (!copy) return null;
  return (
    <p className="text-body text-muted-foreground">
      {t.rich(need === "https" ? "essential.needHttpsRich" : copy.key, {
        variable: (chunks) => (
          <code className="font-mono text-caption text-foreground">
            {chunks}
          </code>
        ),
      })}
    </p>
  );
}
