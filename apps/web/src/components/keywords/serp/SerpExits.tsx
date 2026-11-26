import type { SerpExitItem } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { AppIcon } from "@/components/AppIcon";
import { formatDayMonthInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { serpRole, type SerpViewer } from "./serp-csv";
import { SerpSection } from "./SerpList";
import { SERP_ROW_GRID, SerpAppText } from "./SerpRow";

export function SerpExits({
  exits,
  comparedTo,
  viewer,
}: {
  exits: readonly SerpExitItem[];
  comparedTo: string;
  viewer: SerpViewer;
}) {
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  return (
    <SerpSection
      heading={t("serp.exits.heading", {
        date: formatDayMonthInLocale(comparedTo, locale),
      })}
    >
      <ul className="flex flex-col text-muted-foreground">
        {exits.map((exit) => (
          <li key={exit.storeAppId} className={SERP_ROW_GRID}>
            <span className="col-start-1 row-span-2 row-start-1 text-right text-caption">
              <span aria-hidden>
                {t("serp.exits.was", { position: exit.previous })}
              </span>
              <span className="sr-only">
                {t("serp.exits.spoken", { position: exit.previous })}
              </span>
            </span>
            <span className="col-start-2 row-span-2 row-start-1">
              <AppIcon src={exit.iconUrl} size={40} />
            </span>
            <SerpAppText
              title={exit.title}
              developer={exit.developer}
              role={serpRole(exit, viewer)}
            />
          </li>
        ))}
      </ul>
    </SerpSection>
  );
}
