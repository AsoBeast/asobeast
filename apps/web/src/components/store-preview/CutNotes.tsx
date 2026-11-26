import { InfoTip } from "@/components/ui/info-tip";
import type { FieldCut } from "@/lib/store-preview/cut-sentence";

function EstimateTip() {
  return (
    <InfoTip
      label="About the estimate"
      title="Where the store cuts text"
      summary="Measured with the store's font where this device has it, otherwise a close substitute. The store's own rendering can differ by a few pixels."
    >
      <a
        href="https://docs.asobeast.com/guides/metadata-workbench#preview-the-listing-in-the-store"
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        Read how the preview measures
      </a>
    </InfoTip>
  );
}

export function CutNotes({ cuts }: { cuts: readonly FieldCut[] }) {
  if (cuts.length === 0) return null;
  return (
    <div data-slot="store-preview-cuts" className="flex items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-dense">
        {cuts.map((cut) => (
          <p key={cut.field}>
            <span>{cut.lead}</span>
            <bdi>{cut.words}</bdi>
            <span>{cut.rest}</span>
          </p>
        ))}
      </div>
      <span className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
        <span>Estimate</span>
        <EstimateTip />
      </span>
    </div>
  );
}
