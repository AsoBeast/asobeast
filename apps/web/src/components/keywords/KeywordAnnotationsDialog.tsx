"use client";

import { useId, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { X } from "lucide-react";
import {
  KEYWORD_NOTE_MAX_LENGTH,
  KEYWORD_TAG_MAX_LENGTH,
  KEYWORD_TAGS_MAX,
  normalizeKeywordNote,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addTag,
  splitTagInput,
  tagSuggestions,
  type TagRefusal,
} from "@/lib/keyword-tags";
import { useKeywordUpdate } from "./useKeywordUpdate";

const REFUSAL_MESSAGES: Record<TagRefusal, string> = {
  invalid: `Tags are at most ${KEYWORD_TAG_MAX_LENGTH} letters, numbers, spaces, hyphens or underscores and start with a letter or number.`,
  duplicate: "That tag is already on this keyword.",
  limit: `A keyword has at most ${KEYWORD_TAGS_MAX} tags.`,
};

interface AnnotationsProps {
  appId: string;
  keyword: TrackedKeywordItem;
  marketTags: () => string[];
}

function AnnotationsForm({
  appId,
  keyword,
  marketTags,
  onSaved,
}: AnnotationsProps & { onSaved: () => void }) {
  const update = useKeywordUpdate(appId, keyword);
  const tagsId = useId();
  const messageId = useId();
  const noteId = useId();
  const [tags, setTags] = useState<string[]>(keyword.tags ?? []);
  const [input, setInput] = useState("");
  const [refused, setRefused] = useState<TagRefusal | null>(null);
  const [note, setNote] = useState(keyword.note ?? "");

  function commit(candidates: readonly string[]): TagRefusal | null {
    let next = tags;
    let refusal: TagRefusal | null = null;
    for (const candidate of candidates) {
      const result = addTag(next, candidate);
      next = result.tags;
      refusal = result.refused ?? refusal;
    }
    setTags(next);
    setRefused(refusal);
    return refusal;
  }

  function changeInput(value: string) {
    const { complete, rest } = splitTagInput(value);
    if (complete.length > 0) commit(complete);
    setInput(rest);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (input.trim() !== "" && commit([input]) === null) setInput("");
    } else if (event.key === "Backspace" && input === "" && tags.length > 0) {
      setTags(tags.slice(0, -1));
      setRefused(null);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pending = input.trim();
    const result = pending === "" ? null : addTag(tags, pending);
    if (result?.refused && result.refused !== "duplicate") {
      setRefused(result.refused);
      return;
    }
    setInput("");
    update.mutate(
      { tags: result?.tags ?? tags, note: normalizeKeywordNote(note) },
      { onSuccess: onSaved },
    );
  }

  const suggestions = tagSuggestions(tags, marketTags());

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
      <DialogBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={tagsId}>Tags</Label>
          {tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1" aria-label="Current tags">
              {tags.map((tag) => (
                <li key={tag}>
                  <Badge variant="outline" className="gap-1 pr-0.5">
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="rounded-sm p-0.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
          <Input
            id={tagsId}
            autoFocus
            value={input}
            placeholder="Type a tag, then Enter or a comma"
            aria-describedby={refused ? messageId : undefined}
            onChange={(event) => changeInput(event.target.value)}
            onKeyDown={keyDown}
          />
          {refused ? (
            <p id={messageId} className="text-caption text-destructive">
              {REFUSAL_MESSAGES[refused]}
            </p>
          ) : null}
          {suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {suggestions.map((tag) => (
                <Button
                  key={tag}
                  type="button"
                  variant="outline"
                  size="xs"
                  aria-label={`Add tag ${tag}`}
                  onClick={() => commit([tag])}
                >
                  {tag}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={noteId}>Note</Label>
          <Textarea
            id={noteId}
            value={note}
            maxLength={KEYWORD_NOTE_MAX_LENGTH}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
          />
          <p className="text-caption text-muted-foreground numeric">
            {note.length} / {KEYWORD_NOTE_MAX_LENGTH}
          </p>
        </div>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={update.isPending}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

export function KeywordAnnotationsDialog({
  open,
  onOpenChange,
  ...props
}: AnnotationsProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit tags and note</DialogTitle>
          <DialogDescription>
            Tags and a note for {props.keyword.text}, visible to your workspace
            only.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <AnnotationsForm {...props} onSaved={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
