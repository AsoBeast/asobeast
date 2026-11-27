import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function SessionCheck() {
  const t = useTranslations("auth");
  return (
    <div role="status" aria-label={t("session.checking")}>
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
