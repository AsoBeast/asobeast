import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { LEDE } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import { ImportAppDialog } from "./ImportAppDialog";

const DELIVERIES = [
  "benefitPositions",
  "benefitCompetitors",
  "benefitActions",
] as const;

export function FirstRun() {
  const t = useTranslations("apps.firstRun");
  const commonT = useTranslations("common");
  return (
    <div className="page-reading flex flex-col items-center gap-4 py-20 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-title text-balance">{t("title")}</h1>
        <p className={LEDE}>{t("lede")}</p>
      </div>
      <ul
        aria-label={t("benefitsLabel")}
        className="flex max-w-md flex-col gap-2 text-left"
      >
        {DELIVERIES.map((key) => (
          <li
            key={key}
            className="flex items-start gap-2 text-body text-muted-foreground"
          >
            <CheckCircle2
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-success"
            />
            {t(key)}
          </li>
        ))}
      </ul>
      <ImportAppDialog>
        <Button size="lg">{commonT("importApp")}</Button>
      </ImportAppDialog>
    </div>
  );
}
