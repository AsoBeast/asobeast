"use client";

import { createContext, useContext } from "react";
import { InfoTip } from "@/components/ui/info-tip";

const PLAY_INSTALLS_SUMMARY =
  "The acquisitions and store listing visitors this keyword brought through Google Play search and explore, from the newest complete month Play Console reported. A dash means Google reported no visitors for it.";

export const NoSearchTermsContext = createContext<string | null>(null);

export function PlayInstallsTip() {
  const noSearchTermsStatement = useContext(NoSearchTermsContext);
  return (
    <InfoTip
      label="About Play installs"
      title="Play installs"
      summary={PLAY_INSTALLS_SUMMARY}
    >
      {noSearchTermsStatement ? (
        <p className="text-muted-foreground">{noSearchTermsStatement}</p>
      ) : null}
    </InfoTip>
  );
}
