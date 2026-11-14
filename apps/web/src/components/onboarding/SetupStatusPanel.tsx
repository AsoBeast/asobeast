import type { ReactNode } from "react";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupStatusPanel({
  title,
  sentence,
  actions,
  children,
}: {
  title: string;
  sentence: string;
  actions: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="max-w-[70ch] text-body text-muted-foreground">
          {sentence}
        </p>
        {children}
        <div className="flex flex-wrap gap-2">{actions}</div>
      </CardContent>
    </Card>
  );
}
