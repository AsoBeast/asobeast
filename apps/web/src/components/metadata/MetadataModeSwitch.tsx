"use client";

import { useQueryState } from "nuqs";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { METADATA_MODES, metadataModeParser } from "@/lib/search-params";

const MODE_LABELS = { live: "Live listing", draft: "Draft" } as const;

export function useMetadataMode() {
  return useQueryState(
    "mode",
    metadataModeParser.withOptions({ history: "push" }),
  );
}

export function MetadataModeSwitch() {
  const [mode, setMode] = useMetadataMode();

  return (
    <Tabs
      value={mode}
      onValueChange={(next) => {
        const chosen = METADATA_MODES.find((option) => option === next);
        if (chosen) void setMode(chosen);
      }}
      className="print:hidden"
    >
      <TabsList aria-label="Listing mode">
        {METADATA_MODES.map((option) => (
          <TabsOption key={option} value={option}>
            {MODE_LABELS[option]}
          </TabsOption>
        ))}
      </TabsList>
    </Tabs>
  );
}
