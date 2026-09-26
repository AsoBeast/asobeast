"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Pencil } from "lucide-react";
import type { WebhookEvent } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EventSelection } from "../alert-events";

export function EditEventsDialog({
  label,
  events,
  pending,
  onSave,
}: {
  label: string;
  events: WebhookEvent[];
  pending: boolean;
  onSave: (events: WebhookEvent[]) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<WebhookEvent[]>(events);

  function changeOpen(next: boolean) {
    if (next) setSelected(events);
    setOpen(next);
  }

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (selected.length === 0) return;
    void onSave(selected).then(
      () => setOpen(false),
      () => undefined,
    );
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs">
          <Pencil />
          Edit events
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit events</DialogTitle>
            <DialogDescription>
              Choose the events delivered to{" "}
              <span className="break-all text-foreground">{label}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <EventSelection value={selected} onChange={setSelected} />
            {selected.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Select at least one event to save.
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="submit" disabled={pending || selected.length === 0}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Save events
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
