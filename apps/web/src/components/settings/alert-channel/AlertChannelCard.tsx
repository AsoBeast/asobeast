"use client";

import type { ReactNode } from "react";
import { SettingsPanel } from "../SettingsPanel";

export function AlertChannelCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SettingsPanel title={title} action={action}>
      {children}
    </SettingsPanel>
  );
}

export function AlertChannelEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto max-w-prose px-(--card-spacing) py-8 text-center text-body text-muted-foreground">
      {children}
    </p>
  );
}

export function AlertChannelList({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <ul aria-label={label} className="flex flex-col">
      {children}
    </ul>
  );
}
