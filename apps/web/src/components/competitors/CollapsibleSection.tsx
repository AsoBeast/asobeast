"use client";

import {
  useCallback,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { readCollapsed, writeCollapsed } from "./collapsed-sections";

const listeners = new Set<() => void>();
const localStorage = () => window.localStorage;

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function useCollapsed(section: string) {
  const collapsed = useSyncExternalStore(
    subscribe,
    () => readCollapsed(localStorage, section),
    () => false,
  );
  const setCollapsed = useCallback(
    (next: boolean) => {
      writeCollapsed(localStorage, section, next);
      for (const listener of listeners) listener();
    },
    [section],
  );
  return [collapsed, setCollapsed] as const;
}

const CONTENT_MOTION =
  "overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down";

export function CollapsibleSection({
  section,
  className,
  children,
}: {
  section: string;
  className?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useCollapsed(section);
  return (
    <Collapsible.Root
      open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)}
      className={cn("group/section", className)}
    >
      {children}
    </Collapsible.Root>
  );
}

export function CollapsibleCard({
  section,
  ...props
}: ComponentProps<typeof Card> & { section: string }) {
  const [collapsed, setCollapsed] = useCollapsed(section);
  return (
    <Collapsible.Root
      asChild
      open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)}
    >
      <Card {...props} />
    </Collapsible.Root>
  );
}

export function CollapseToggle({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <Collapsible.Trigger asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Show or hide ${label}`}
        className={cn("group/toggle print:hidden", className)}
      >
        <ChevronDown
          aria-hidden
          className="transition-transform duration-200 group-data-[state=closed]/toggle:-rotate-90 motion-reduce:transition-none"
        />
      </Button>
    </Collapsible.Trigger>
  );
}

export function CollapsibleContent({
  className,
  ...props
}: ComponentProps<typeof Collapsible.Content>) {
  return (
    <Collapsible.Content className={cn(CONTENT_MOTION, className)} {...props} />
  );
}
