"use client";

import { useId, useState } from "react";
import { Tag } from "lucide-react";
import {
  isKeywordTag,
  KEYWORD_TAGS_MAX,
  normalizeKeywordTag,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  bulkTagChanges,
  tagSuggestions,
  type BulkTagChange,
  type BulkTagMode,
} from "@/lib/keyword-tags";

const keywordsCount = (count: number) =>
  `${count} keyword${count === 1 ? "" : "s"}`;

export function BulkTagPopover({
  keywords,
  marketTags,
  disabled,
  onApply,
}: {
  keywords: readonly TrackedKeywordItem[];
  marketTags: readonly string[];
  disabled: boolean;
  onApply: (changes: BulkTagChange[], mode: BulkTagMode) => void;
}) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const tag = normalizeKeywordTag(input);
  const valid = isKeywordTag(tag);
  const add = bulkTagChanges(keywords, tag, "add");
  const remove = bulkTagChanges(keywords, tag, "remove");

  function apply(changes: BulkTagChange[], mode: BulkTagMode) {
    onApply(changes, mode);
    setOpen(false);
    setInput("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Tag />
          Tag
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={inputId}>Tag to add or remove</Label>
          <Input
            id={inputId}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {tagSuggestions([], marketTags).map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setInput(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
        {valid && add.atLimit.length > 0 ? (
          <p className="text-caption text-muted-foreground">
            Skips {keywordsCount(add.atLimit.length)} at the {KEYWORD_TAGS_MAX}{" "}
            tag limit: {add.atLimit.join(", ")}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!valid || add.changes.length === 0}
            onClick={() => apply(add.changes, "add")}
          >
            Add to {keywordsCount(add.changes.length)}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!valid || remove.changes.length === 0}
            onClick={() => apply(remove.changes, "remove")}
          >
            Remove from {keywordsCount(remove.changes.length)}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
