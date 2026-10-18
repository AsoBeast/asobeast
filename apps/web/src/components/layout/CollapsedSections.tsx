"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  collapsedCookie,
  parseCollapsed,
  readCollapsedCookie,
  serializeCollapsed,
  withSection,
} from "@/lib/collapsed-sections";

interface CollapsedSections {
  collapsed: ReadonlySet<string>;
  setOpen: (section: string, open: boolean) => void;
}

const CollapsedSectionsContext = createContext<CollapsedSections | null>(null);

function seed(
  initial: readonly string[],
  known: readonly string[],
): ReadonlySet<string> {
  if (typeof document === "undefined") return new Set(initial);
  return parseCollapsed(readCollapsedCookie(document.cookie), known);
}

export function CollapsedSectionsProvider({
  initial,
  known,
  children,
}: {
  initial: readonly string[];
  known: readonly string[];
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => seed(initial, known));

  const setOpen = useCallback(
    (section: string, open: boolean) => {
      const next = withSection(collapsed, section, open);
      setCollapsed(next);
      document.cookie = collapsedCookie(serializeCollapsed(next, known));
    },
    [collapsed, known],
  );

  const value = useMemo(() => ({ collapsed, setOpen }), [collapsed, setOpen]);

  return (
    <CollapsedSectionsContext value={value}>
      {children}
    </CollapsedSectionsContext>
  );
}

function useCollapsedSections(): CollapsedSections {
  const context = useContext(CollapsedSectionsContext);
  if (context === null) {
    throw new Error("A section needs a CollapsedSectionsProvider above it");
  }
  return context;
}

export function useSectionOpen(
  section: string,
): readonly [open: boolean, setOpen: (open: boolean) => void] {
  const { collapsed, setOpen } = useCollapsedSections();
  const change = useCallback(
    (open: boolean) => setOpen(section, open),
    [setOpen, section],
  );
  return [!collapsed.has(section), change];
}
