"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ANNOTATION_LABEL_MAX_LENGTH,
  ANNOTATION_TAG_MAX_LENGTH,
  type AppAnnotationItem,
} from "@asobeast/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { addAnnotation, ApiError, deleteAnnotation } from "@/lib/api";
import { focusCanMoveTo, survivingNeighbour } from "@/lib/focus-handoff";
import { formatCountry, formatDate } from "@/lib/format";
import {
  annotationsOptions,
  invalidateAnnotationMutation,
} from "@/lib/queries";
import { useKeyedSingleFlight, useSingleFlight } from "@/lib/single-flight";
import { limitCounterText, textLimit } from "@/lib/text-limit";
import { AnnotationsSkeleton } from "./skeletons";

function AnnotationRow({
  annotation,
  removing,
  onRemove,
  registerButton,
}: {
  annotation: AppAnnotationItem;
  removing: boolean;
  onRemove: (annotation: AppAnnotationItem) => void;
  registerButton: (annotationId: string, button: HTMLButtonElement) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex items-start gap-3 py-2">
      <span className="w-24 shrink-0 pt-0.5 text-caption text-muted-foreground">
        {formatDate(annotation.date)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-body break-words">{annotation.label}</span>
        {annotation.tag !== null || annotation.market !== null ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {annotation.tag !== null ? (
              <Badge variant="secondary">{annotation.tag}</Badge>
            ) : null}
            {annotation.market !== null ? (
              <Badge variant="outline">
                {formatCountry(annotation.market)}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${annotation.label}`}
            ref={(button) => {
              if (button) registerButton(annotation.id, button);
            }}
          >
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {annotation.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              The marker disappears from the rank history and visibility charts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              aria-disabled={removing || undefined}
              onClick={(event) => {
                if (removing) event.preventDefault();
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              aria-disabled={removing || undefined}
              onClick={(event) => {
                event.preventDefault();
                onRemove(annotation);
              }}
            >
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AnnotationsList({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const list = useQuery(annotationsOptions(id));
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const removing = useRef(new Set<string>());
  const seen = useRef<AppAnnotationItem[] | null>(null);

  const remove = useMutation({
    mutationFn: (annotation: AppAnnotationItem) =>
      deleteAnnotation(id, annotation.id),
    onSuccess: (_data, annotation) => {
      invalidateAnnotationMutation(queryClient, id);
      toast.success(`Removed ${annotation.label}`);
    },
    onError: (_error, annotation) => {
      removing.current.delete(annotation.id);
      toast.error(`Could not remove ${annotation.label}`);
    },
  });
  const removeOnce = useKeyedSingleFlight(remove, (row) => row.id);

  useEffect(() => {
    const previous = seen.current;
    seen.current = list.data?.annotations ?? null;
    if (!previous) return;
    const gone = previous.filter(
      (row) =>
        !seen.current?.some((kept) => kept.id === row.id) &&
        removing.current.has(row.id),
    );
    if (gone.length === 0) return;
    for (const row of gone) removing.current.delete(row.id);
    const removed = new Set(gone.map((row) => row.id));
    const survivor = survivingNeighbour(previous, (row) => removed.has(row.id));
    const target =
      (survivor ? buttons.current.get(survivor.id) : undefined) ??
      document.getElementById("annotation-add");
    if (target?.isConnected && focusCanMoveTo(target)) target.focus();
  });

  if (list.isPending) {
    return <AnnotationsSkeleton />;
  }

  if (failedRead(list)) {
    return (
      <InlineQueryError message="Could not load the annotations." read={list} />
    );
  }

  const rows = list.data?.annotations ?? [];

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No annotations yet"
        body="Pin a release, a listing change or the start of a campaign to its day, and the charts draw a line there."
      />
    );
  }

  return (
    <div className="divide-y">
      {rows.map((annotation) => (
        <AnnotationRow
          key={annotation.id}
          annotation={annotation}
          removing={remove.isPending && remove.variables?.id === annotation.id}
          onRemove={(row) => {
            removing.current.add(row.id);
            removeOnce(row);
          }}
          registerButton={(annotationId, button) => {
            buttons.current.set(annotationId, button);
          }}
        />
      ))}
    </div>
  );
}

function AddAnnotationForm({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const labelLimit = textLimit(label, ANNOTATION_LABEL_MAX_LENGTH);
  const tagLimit = textLimit(tag, ANNOTATION_TAG_MAX_LENGTH);

  const mutation = useMutation({
    mutationFn: () =>
      addAnnotation(id, {
        date,
        label,
        ...(tag.trim() === "" ? {} : { tag: tag.trim() }),
      }),
    onSuccess: () => {
      invalidateAnnotationMutation(queryClient, id);
      setDate("");
      setLabel("");
      setTag("");
      setError(null);
      toast.success("Annotation added");
    },
    onError: (err) => {
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not reach the api to add this annotation",
      );
    },
  });
  const addOnce = useSingleFlight(mutation);
  const addable =
    date !== "" &&
    label.trim() !== "" &&
    labelLimit.over === 0 &&
    tagLimit.over === 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (mutation.isPending || !addable) return;
    addOnce();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="annotation-date">Date</Label>
          <Input
            id="annotation-date"
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="annotation-label">Label</Label>
          <Input
            id="annotation-label"
            required
            placeholder="Release 5.21.0"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          {labelLimit.over > 0 ? (
            <p className="text-caption text-destructive">
              {limitCounterText(labelLimit, ANNOTATION_LABEL_MAX_LENGTH)}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-40 flex-col gap-1.5">
          <Label htmlFor="annotation-tag">Tag (optional)</Label>
          <Input
            id="annotation-tag"
            placeholder="wave"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          />
          {tagLimit.over > 0 ? (
            <p className="text-caption text-destructive">
              {limitCounterText(tagLimit, ANNOTATION_TAG_MAX_LENGTH)}
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          id="annotation-add"
          aria-disabled={mutation.isPending || !addable || undefined}
        >
          {mutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {mutation.isPending ? "Adding…" : "Add annotation"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function AnnotationsCard({ id }: { id: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Event markers</CardDescription>
        <CardTitle>Annotations</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AnnotationsList id={id} />
        <AddAnnotationForm id={id} />
      </CardContent>
    </Card>
  );
}
