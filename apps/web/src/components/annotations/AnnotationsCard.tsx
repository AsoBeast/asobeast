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
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  closeUnlessPending,
  ConfirmActionFooter,
} from "@/components/ConfirmActionFooter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PANEL_ACTION, PANEL_HEADER } from "@/components/layout/panel-classes";
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

  const facts = [
    ...(annotation.tag === null ? [] : [annotation.tag]),
    ...(annotation.market === null ? [] : [formatCountry(annotation.market)]),
  ];

  return (
    <li className="flex min-h-10 items-center gap-3 rounded-md py-1 pr-1 pl-2 text-dense transition-colors duration-150 ease-out hover:bg-muted sm:min-h-9">
      <span className="numeric w-24 shrink-0 text-faint-foreground">
        {formatDate(annotation.date)}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <bdi className="font-medium wrap-anywhere">{annotation.label}</bdi>
        {facts.length > 0 ? (
          <span className="text-caption text-faint-foreground wrap-anywhere">
            {facts.join(" · ")}
          </span>
        ) : null}
      </span>
      <AlertDialog
        open={confirmOpen}
        onOpenChange={closeUnlessPending(removing, setConfirmOpen)}
      >
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="print:hidden"
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
          <ConfirmActionFooter
            pending={removing}
            label="Remove"
            pendingLabel="Removing…"
            onConfirm={() => onRemove(annotation)}
          />
        </AlertDialogContent>
      </AlertDialog>
    </li>
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
    <ul className="flex flex-col">
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
    </ul>
  );
}

function AddAnnotationForm({
  id,
  onAdded,
}: {
  id: string;
  onAdded: () => void;
}) {
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
      onAdded();
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
      <div className="flex flex-col gap-3">
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
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
          className="ml-auto"
          aria-disabled={mutation.isPending || !addable || undefined}
        >
          {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
          {mutation.isPending ? "Adding…" : "Add"}
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

function AddAnnotation({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="annotation-add"
          variant="outline"
          size="sm"
          className="print:hidden"
        >
          <Plus />
          Add annotation
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="Add an annotation"
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] p-4"
      >
        <AddAnnotationForm id={id} onAdded={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

export function AnnotationsCard({ id }: { id: string }) {
  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>Annotations</h2>
        </CardTitle>
        <CardAction className={PANEL_ACTION}>
          <AddAnnotation id={id} />
        </CardAction>
      </CardHeader>
      <CardContent className="px-2">
        <AnnotationsList id={id} />
      </CardContent>
      <CardFooter>
        <span>Drawn as dashed lines on this app’s charts</span>
      </CardFooter>
    </Card>
  );
}
