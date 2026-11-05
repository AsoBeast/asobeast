import type { ReactNode } from "react";
import type { AppSummary, ShareOfVoice } from "@asobeast/shared";
import { TrendChip } from "@/components/ui/delta-chip";
import { ShareOfVoiceHelp } from "@/components/visibility/ShareOfVoiceHelp";
import { competitorsCaption, shareLine } from "./share-of-voice-text";

function ShareRow({
  label,
  block,
  help,
}: {
  label: string;
  block: ShareOfVoice;
  help?: ReactNode;
}) {
  const measured = block.current !== null;
  return (
    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      <p className="flex items-center gap-1">
        <span>{label}</span>
        {measured ? (
          <span className="numeric font-mono font-medium text-foreground">
            {shareLine(block)}
          </span>
        ) : null}
        {help}
      </p>
      <p className="flex flex-wrap items-center gap-x-2">
        {measured ? (
          <>
            <TrendChip label="7d" value={block.delta7d} digits={1} />
            <span>{competitorsCaption(block.competitors)}</span>
          </>
        ) : (
          <span>{shareLine(block)}</span>
        )}
      </p>
    </div>
  );
}

export function ShareOfVoiceLine({ summary }: { summary: AppSummary }) {
  const { shareOfVoice, nonBrandedShareOfVoice } = summary;
  if (shareOfVoice === undefined) return null;
  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <ShareRow
        label="Share of voice"
        block={shareOfVoice}
        help={<ShareOfVoiceHelp />}
      />
      {nonBrandedShareOfVoice ? (
        <ShareRow label="Non branded" block={nonBrandedShareOfVoice} />
      ) : null}
    </div>
  );
}
