"use client";

import { Sparkles } from "lucide-react";
import type {
  AppLocalizationItem,
  AppLocalizationStoreSync,
  AppStoreLocalization,
} from "@asobeast/shared";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useFocusClaim } from "@/lib/focus-handoff";
import { ShareTrack } from "@/components/metadata/ShareTrack";
import { localizationName } from "@/lib/localizations";
import { KeywordFieldEditor } from "./KeywordFieldEditor";
import { OriginMark } from "./OriginMark";
import { ReaderChips } from "./ReadRoleBadge";
import { RemoveLocalizationDialog } from "./RemoveLocalizationDialog";

export const localizationFocusKey = (
  localization: AppStoreLocalization,
): string => `localization-${localization}`;

export function LocalizationItem({
  id,
  item,
  managed = false,
  sync = null,
  onDraft,
  proposed = null,
  drafted,
  editorKey = "stored",
  onProposalSettled,
  unlistedIn = null,
}: {
  id: string;
  item: AppLocalizationItem;
  unlistedIn?: string | null;
  managed?: boolean;
  sync?: AppLocalizationStoreSync | null;
  onDraft: ((localization: AppStoreLocalization) => void) | null;
  proposed?: readonly string[] | null;
  drafted?: string;
  editorKey?: string;
  onProposalSettled?: () => void;
}) {
  const name = localizationName(item.localization);
  const claimFocus = useFocusClaim(localizationFocusKey(item.localization));

  return (
    <AccordionItem
      value={item.localization}
      className="border-border-subtle data-[state=open]:bg-muted data-[state=open]:shadow-[inset_2px_0_0_var(--foreground)]"
    >
      <AccordionTrigger
        ref={claimFocus}
        className="min-h-11 items-center rounded-none px-4 py-2 hover:bg-muted hover:no-underline focus-visible:ring-inset"
      >
        <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 @2xl/metadata:grid-cols-[minmax(0,1fr)_auto_auto_14rem]">
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{name}</span>
            <OriginMark origin={item.origin} />
          </span>
          <ShareTrack
            share={
              item.charactersLimit === 0
                ? 0
                : item.charactersUsed / item.charactersLimit
            }
            className="w-14 @2xl/metadata:w-28"
          />
          <span className="numeric min-w-14 text-right text-label font-normal text-faint-foreground">
            {`${item.charactersUsed}/${item.charactersLimit}`}
          </span>
          <span className="col-span-3 flex flex-wrap items-center gap-1 @2xl/metadata:col-span-1 @2xl/metadata:justify-end">
            <ReaderChips readers={item.readBy} />
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent forceMount className="px-4 pb-4">
        <div className="flex flex-col gap-3">
          {unlistedIn ? (
            <UnlistedHomeNote storefront={unlistedIn} name={name} />
          ) : null}
          {onDraft && !managed ? (
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
          <KeywordFieldEditor
            key={editorKey}
            id={id}
            item={item}
            managed={managed}
            sync={sync}
            proposed={proposed}
            drafted={drafted}
            onProposalSettled={onProposalSettled}
            leading={
              managed || item.origin === "home" ? null : (
                <RemoveLocalizationDialog id={id} item={item} />
              )
            }
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function UnlistedHomeNote({
  storefront,
  name,
}: {
  storefront: string;
  name: string;
}) {
  const code = storefront.toUpperCase();
  return (
    <p className="text-caption text-muted-foreground">
      <span>{`The ${code} storefront does not list ${name}. It shows this listing by default, so AsoBeast reads it as the ${code} default.`}</span>
    </p>
  );
}
