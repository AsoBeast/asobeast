import type { MetadataField } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { InfoTip } from "@/components/ui/info-tip";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";

export function NotSearchedLabel({ field }: { field: MetadataField }) {
  const t = useTranslations("metadata");
  const label = t("notSearched");
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-caption font-normal text-faint-foreground">
        {label}
      </span>
      <InfoTip
        label={t("notSearchedTipLabel", {
          field: METADATA_FIELD_LABELS[field],
        })}
        title={label}
        summary={t("notSearchedTipSummary")}
      >
        <a
          href="https://docs.asobeast.com/concepts/stores#what-does-each-store-index"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground link-underline"
        >
          {t("whatEachStoreSearches")}
        </a>
      </InfoTip>
    </span>
  );
}
