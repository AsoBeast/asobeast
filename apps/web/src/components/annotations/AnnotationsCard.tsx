"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AppAnnotationItem } from "@asobeast/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import { addAnnotation, ApiError, deleteAnnotation } from "@/lib/api";
import { formatCountry, formatDate } from "@/lib/format";
import { annotationsOptions, appKeys } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

function AnnotationRow({
  id,
  annotation,
}: {
  id: string;
  annotation: AppAnnotationItem;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteAnnotation(id, annotation.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appKeys.annotations(id) });
      setConfirmOpen(false);
      toast.success(`Removed ${annotation.label}`);
    },
    onError: () => {
      toast.error(`Could not remove ${annotation.label}`);
    },
  });
  const removeOnce = useSingleFlight(mutation);

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
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${annotation.label}`}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 />
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {annotation.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              The marker disappears from the rank history and visibility charts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                removeOnce();
              }}
            >
              {mutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AnnotationsList({ id }: { id: string }) {
  const { data } = useSuspenseQuery(annotationsOptions(id));

  if (data.annotations.length === 0) {
    return (
      <EmptyState
        title="No annotations yet"
        body="Pin a release, a listing change or the start of a campaign to its day, and the charts draw a line there."
      />
    );
  }

  return (
    <div className="divide-y">
      {data.annotations.map((annotation) => (
        <AnnotationRow key={annotation.id} id={id} annotation={annotation} />
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

  const mutation = useMutation({
    mutationFn: () =>
      addAnnotation(id, {
        date,
        label,
        ...(tag.trim() === "" ? {} : { tag: tag.trim() }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appKeys.annotations(id) });
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
            maxLength={80}
            placeholder="Release 5.21.0"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-40 flex-col gap-1.5">
          <Label htmlFor="annotation-tag">Tag (optional)</Label>
          <Input
            id="annotation-tag"
            maxLength={24}
            placeholder="wave"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          />
        </div>
        <Button
          type="submit"
          disabled={mutation.isPending || date === "" || label.trim() === ""}
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
