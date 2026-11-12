"use client";

import { ChartScatter } from "lucide-react";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { keywordViewParser } from "@/lib/search-params";

export function KeywordViewSwitch() {
  const [view, setView] = useQueryState("view", keywordViewParser);
  const shown = view === "map";
  return (
    <Button
      variant="outline"
      aria-pressed={shown}
      className="aria-pressed:bg-accent"
      onClick={() => void setView(shown ? "table" : "map")}
    >
      <ChartScatter aria-hidden />
      <span className="max-sm:sr-only">Map</span>
    </Button>
  );
}
