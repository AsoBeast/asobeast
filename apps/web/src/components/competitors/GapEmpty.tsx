import { GAP_TOP } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCountryInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { GapEmpty as GapEmptyKind, GapTab } from "@/lib/gap-lists";
import { SECTION_EMPTY } from "./section-layout";

const TAB_EMPTY: Record<
  GapTab,
  "gapsTitle" | "winnableTitle" | "threatsTitle" | "leadTitle"
> = {
  gaps: "gapsTitle",
  winnable: "winnableTitle",
  threats: "threatsTitle",
  lead: "leadTitle",
};

export function GapEmpty({
  kind,
  tab,
  country,
}: {
  kind: GapEmptyKind;
  tab: GapTab;
  country: string;
}) {
  const t = useTranslations("competitors");
  const locale = useAppLocale();
  if (kind === "noCompetitors") {
    return (
      <EmptyState
        className={SECTION_EMPTY}
        title={t("gaps.empty.noCompetitorsTitle")}
        body={t("gaps.empty.noCompetitorsBody")}
        action={
          <a
            href="#competitor-search"
            className="text-dense font-medium link-underline"
          >
            {t("comparison.addCta")}
          </a>
        }
      />
    );
  }
  if (kind === "allDelisted") {
    return (
      <EmptyState
        className={SECTION_EMPTY}
        title={t("gaps.empty.allDelistedTitle")}
        body={t("gaps.empty.allDelistedBody")}
      />
    );
  }
  if (kind === "notCompared") {
    return (
      <EmptyState
        className={SECTION_EMPTY}
        title={
          country === ""
            ? t("gaps.empty.notCompared")
            : t("gaps.empty.notComparedMarket", {
                market: formatCountryInLocale(country, locale),
              })
        }
        body={t("gaps.empty.nextCheck")}
      />
    );
  }
  const titleKey = TAB_EMPTY[tab];
  return (
    <EmptyState
      className={SECTION_EMPTY}
      title={t(`gaps.empty.${titleKey}`)}
      body={
        tab === "gaps" ? t("gaps.empty.gapsBody", { top: GAP_TOP }) : undefined
      }
    />
  );
}
