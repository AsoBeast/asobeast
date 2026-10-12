"use client";

import { Sparkles } from "lucide-react";
import type {
  AppLocalizationItem,
  AppStoreLocalization,
  LocalizationReader,
} from "@asobeast/shared";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { localizationName } from "@/lib/localizations";
import { KeywordFieldEditor } from "./KeywordFieldEditor";
import { OriginBadge } from "./OriginBadge";
import { ReadRoleBadge } from "./ReadRoleBadge";

function ReaderChips({ readers }: { readers: readonly LocalizationReader[] }) {
  if (readers.length === 0) {
    return <Badge variant="outline">Not read in your markets</Badge>;
  }
  return (
    <>
      {readers.map((reader) => (
        <ReadRoleBadge
          key={reader.country}
          role={reader.role}
          prefix={reader.country.toUpperCase()}
        />
      ))}
    </>
  );
}

export function LocalizationItem({
  id,
  item,
  onDraft,
}: {
  id: string;
  item: AppLocalizationItem;
  onDraft: ((localization: AppStoreLocalization) => void) | null;
}) {
  const name = localizationName(item.localization);

  return (
    <AccordionItem value={item.localization}>
      <AccordionTrigger className="items-center hover:no-underline">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-2">
            <span className="font-medium">{name}</span>
            <OriginBadge origin={item.origin} />
          </span>
          <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <span className="numeric font-mono text-caption text-muted-foreground">
              {item.charactersUsed}/{item.charactersLimit}
            </span>
            <ReaderChips readers={item.readBy} />
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent forceMount>
        <div className="flex flex-col gap-3">
          {onDraft ? (
            <div>
              <Button
                variant="outline"
                size="xs"
                aria-label={`Draft with AI: ${name}`}
                onClick={() => onDraft(item.localization)}
              >
                <Sparkles aria-hidden />
                Draft with AI
              </Button>
            </div>
          ) : null}
          <KeywordFieldEditor id={id} item={item} />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
