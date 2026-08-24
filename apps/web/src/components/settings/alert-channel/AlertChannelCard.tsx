"use client";

import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Alerts</CardDescription>
          <CardTitle>{title}</CardTitle>
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AlertChannelEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
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
    <ul aria-label={label} className="divide-y rounded-xl border">
      {children}
    </ul>
  );
}
