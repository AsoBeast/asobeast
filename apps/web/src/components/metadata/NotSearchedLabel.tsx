import type { MetadataField } from "@asobeast/shared";
import { InfoTip } from "@/components/ui/info-tip";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";

export function NotSearchedLabel({ field }: { field: MetadataField }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-caption font-normal text-faint-foreground">
        Not searched by the store
      </span>
      <InfoTip
        label={`Why the store does not search ${METADATA_FIELD_LABELS[field]}`}
        title="Not searched by the store"
        summary="The App Store does not search this field, so words in it do not help you rank. Write it for the people who read your page."
      >
        <a
          href="https://docs.asobeast.com/concepts/stores#what-does-each-store-index"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground link-underline"
        >
          What each store searches
        </a>
      </InfoTip>
    </span>
  );
}
