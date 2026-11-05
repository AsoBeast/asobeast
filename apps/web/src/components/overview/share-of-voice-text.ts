import type { ShareOfVoice, ShareOfVoiceReason } from "@asobeast/shared";
import { pluralize } from "@/lib/format";

const REASONS: Record<ShareOfVoiceReason, string> = {
  noCompetitors: "Add a competitor to see your share of voice",
  notChecked: "Your competitors have not been checked yet",
  nobodyRanks: "Nobody ranks for these keywords yet",
};

export const formatShare = (value: number): string => `${value.toFixed(1)}%`;

export const shareReason = (reason: ShareOfVoiceReason | undefined): string =>
  REASONS[reason ?? "notChecked"];

export const shareLine = (block: ShareOfVoice): string =>
  block.current === null
    ? shareReason(block.reason)
    : formatShare(block.current);

export const competitorsCaption = (count: number): string =>
  `vs ${pluralize(count, "competitor")}`;
