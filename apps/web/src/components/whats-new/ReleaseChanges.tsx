"use client";

import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  RELEASE_KINDS,
  type Release,
  type ReleaseChange,
  type ReleaseKind,
} from "@/lib/whats-new/release-notes";
import { firstSentence, KIND_SHOWN } from "./release-view";

const ROW =
  "relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2 rounded-md px-2 py-2 text-body";

function ChangeRow({ change }: { change: ReleaseChange }) {
  const [open, setOpen] = useState(false);
  const textId = useId();
  return (
    <li
      className={cn(
        ROW,
        "transition-colors duration-150 ease-out",
        !open && "hover:bg-muted",
      )}
    >
      <ChevronRight
        aria-hidden
        className={cn(
          "mt-1 size-4 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none",
          open && "rotate-90",
        )}
      />
      <p
        className={cn("wrap-anywhere", !open && "line-clamp-2 md:line-clamp-1")}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={textId}
          onClick={() => setOpen((current) => !current)}
          className="rounded-sm text-left font-medium text-foreground outline-none after:absolute after:inset-0 after:rounded-md focus-visible:ring-2 focus-visible:ring-ring"
        >
          {`${change.title}.`}
        </button>
        <span> </span>
        <span id={textId} className="text-muted-foreground">
          {open ? change.text : firstSentence(change.text)}
        </span>
      </p>
    </li>
  );
}

function ChangeGroup({
  release,
  kind,
}: {
  release: Release;
  kind: ReleaseKind;
}) {
  const t = useTranslations("releaseNotes");
  const [all, setAll] = useState(false);
  const headingId = useId();
  const changes = release.changes.filter((change) => change.kind === kind);
  if (changes.length === 0) return null;
  const limit = KIND_SHOWN[kind];
  const shown = all ? changes : changes.slice(0, limit);
  const label = t(`kinds.${kind}`);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h3
        id={headingId}
        className="flex min-h-8 items-center border-b border-border-subtle text-label text-muted-foreground"
      >
        {label}
      </h3>
      <ul className="-mx-2 flex flex-col">
        {shown.map((change) => (
          <ChangeRow key={change.title} change={change} />
        ))}
      </ul>
      {changes.length > limit ? (
        <Button
          variant="ghost"
          size="sm"
          className="ml-4 self-start"
          aria-expanded={all}
          onClick={() => setAll((current) => !current)}
        >
          {all
            ? t("showFirst", { count: limit })
            : t("showAll", { count: changes.length, kind: label })}
        </Button>
      ) : null}
    </section>
  );
}

export function ReleaseChanges({ release }: { release: Release }) {
  return (
    <>
      {RELEASE_KINDS.map((kind) => (
        <ChangeGroup key={kind} release={release} kind={kind} />
      ))}
    </>
  );
}
