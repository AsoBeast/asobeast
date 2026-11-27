"use client";

import { useRef, type ReactNode, type RefObject } from "react";
import { Lightbulb } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { rememberIdeasOpener, requestIdeasFocus } from "./ideas-opener";

export function useIdeasMenu(
  menu: RefObject<HTMLButtonElement | null>,
  seed: string,
  onOpenIdeas: ((seed: string) => void) | undefined,
): {
  item: ReactNode;
  onCloseAutoFocus: (event: Event) => void;
} {
  const opened = useRef(false);
  return {
    item: onOpenIdeas ? (
      <DropdownMenuItem
        onSelect={() => {
          opened.current = true;
          rememberIdeasOpener(menu.current, seed);
          onOpenIdeas(seed);
        }}
      >
        <Lightbulb />
        Ideas
      </DropdownMenuItem>
    ) : null,
    onCloseAutoFocus: (event) => {
      if (!opened.current) return;
      opened.current = false;
      event.preventDefault();
      requestIdeasFocus();
    },
  };
}
