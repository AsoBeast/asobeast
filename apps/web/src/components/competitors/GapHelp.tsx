import {
  GAP_TOP,
  GAP_YOU_BELOW,
  THREAT_WINDOW_DAYS,
  THREAT_WITHIN,
  WINNABLE_COMPETITOR_FROM,
} from "@asobeast/shared";
import { InfoTip } from "@/components/ui/info-tip";
import { useTranslations } from "next-intl";

export function GapHelp() {
  const t = useTranslations("competitors");
  const rules = [
    {
      name: t("gaps.help.keywordGaps"),
      rule: t("gaps.help.keywordGapsRule", {
        top: GAP_TOP,
        below: GAP_YOU_BELOW,
      }),
    },
    {
      name: t("gaps.help.winnable"),
      rule: t("gaps.help.winnableRule", { from: WINNABLE_COMPETITOR_FROM }),
    },
    {
      name: t("gaps.help.threats"),
      rule: t("gaps.help.threatsRule", {
        top: GAP_TOP,
        within: THREAT_WITHIN,
        days: THREAT_WINDOW_DAYS,
      }),
    },
    { name: t("gaps.help.lead"), rule: t("gaps.help.leadRule") },
  ];
  return (
    <InfoTip
      label={t("gaps.help.label")}
      title={t("gaps.help.title")}
      summary={t("gaps.help.summary")}
    >
      <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
        {rules.map(({ name, rule }) => (
          <li key={name}>
            <strong className="text-foreground">{name}</strong>{" "}
            <span>{rule}</span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">{t("gaps.help.badge")}</p>
      <a
        href="https://docs.asobeast.com/guides/competitors#gap-analysis"
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        {t("gaps.help.readMore")}
      </a>
    </InfoTip>
  );
}
