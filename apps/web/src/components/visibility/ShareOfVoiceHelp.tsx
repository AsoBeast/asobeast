import { useTranslations } from "next-intl";
import { InfoTip } from "@/components/ui/info-tip";
import { SHARE_EXAMPLE } from "./share-of-voice-help";
import { SHARE_OF_VOICE_GUIDE } from "./visibility-help";

export function ShareOfVoiceHelp() {
  const t = useTranslations("metrics.shareOfVoice");
  const [first, second] = SHARE_EXAMPLE.rivals;
  return (
    <InfoTip label={t("label")} title={t("title")} summary={t("summary")}>
      <p className="text-muted-foreground">
        {t("example", {
          you: SHARE_EXAMPLE.you,
          first,
          second,
          share: SHARE_EXAMPLE.share,
          againstOne: SHARE_EXAMPLE.againstOne,
        })}
      </p>
      <p className="text-muted-foreground">{t("checkedOnly")}</p>
      <a
        href={SHARE_OF_VOICE_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        {t("readCalculation")}
      </a>
    </InfoTip>
  );
}
