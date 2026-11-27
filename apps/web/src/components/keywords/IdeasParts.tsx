"use client";

import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCountry } from "@/lib/format";
import { DEEP_SEARCH_LENGTH } from "./deep-search";

export function IdeasHeader({
  heading,
  seed,
  country,
  onClose,
}: {
  heading: React.Ref<HTMLHeadingElement>;
  seed: string;
  country: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3
          ref={heading}
          tabIndex={-1}
          className="text-heading wrap-anywhere outline-none"
        >
          {`Ideas for “${seed}”`}
        </h3>
        <p className="text-caption text-muted-foreground">
          {`Store search suggestions around this keyword in ${formatCountry(country)}`}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onClose}>
        <X />
        Close ideas
      </Button>
    </div>
  );
}

export function IdeasStartPrompt({
  pending,
  onStart,
}: {
  pending: boolean;
  onStart: (button: HTMLButtonElement) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <p className="max-w-prose text-body text-muted-foreground">
        {`Asks the store for what people type after this keyword on its own and followed by each letter from a to z. That is ${DEEP_SEARCH_LENGTH}.`}
      </p>
      <Button
        size="sm"
        aria-disabled={pending || undefined}
        onClick={(event) => {
          if (!pending) onStart(event.currentTarget);
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Search />}
        Find ideas
      </Button>
    </div>
  );
}
