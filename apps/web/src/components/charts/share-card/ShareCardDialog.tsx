"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Copy, ImageDown, Share2 } from "lucide-react";
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
import { headlineSentence } from "@/lib/chart-image/share-card/headline";
import {
  paintShareCard,
  type ShareCardSpec,
} from "@/lib/chart-image/share-card/render-card";
import { ShareCardControls } from "./ShareCardControls";
import { type ShareCardSource, useShareCard } from "./use-share-card";

const SHARE_CARD_GUIDE =
  "https://docs.asobeast.com/guides/read-rankings#share-a-card";

function ShareCardPreview({
  spec,
  label,
}: {
  spec: ShareCardSpec | null;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && spec) void paintShareCard(canvas, spec);
  }, [spec]);
  return (
    <div className="flex min-h-40 items-center justify-center rounded-md bg-muted p-3">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        aria-busy={spec === null || undefined}
        className="h-auto max-h-[45svh] w-auto max-w-full rounded-md border border-border"
      />
    </div>
  );
}

function ShareTrigger({
  subject,
  ...props
}: ComponentProps<typeof Button> & { subject: string }) {
  return (
    <Button variant="outline" size="sm" className="print:hidden" {...props}>
      <Share2 aria-hidden />
      Share
      <span className="sr-only">{` ${subject}`}</span>
    </Button>
  );
}

export function ShareCardDialog({
  subject,
  source,
  trigger,
  loading = false,
  onOpenChange,
}: {
  subject: string;
  source: ShareCardSource;
  trigger?: ReactNode;
  loading?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const card = useShareCard(source, open, loading);
  const reportClosed = useEffectEvent(() => onOpenChange?.(false));
  useEffect(() => {
    if (!open) return;
    return () => reportClosed();
  }, [open]);
  const busy = card.busy || undefined;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && loading) return;
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      <DialogTrigger asChild aria-disabled={loading || undefined}>
        {trigger ?? <ShareTrigger subject={subject} />}
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{`Share ${subject}`}</DialogTitle>
          <DialogDescription>
            Pick a size and a theme, then copy or download the card.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ShareCardPreview
            spec={card.spec}
            label={headlineSentence(source.headline, card.options.change)}
          />
          <ShareCardControls
            options={card.options}
            onChange={card.setOptions}
          />
          <p className="text-caption text-muted-foreground">
            <a
              href={SHARE_CARD_GUIDE}
              target="_blank"
              rel="noreferrer"
              className="link-underline"
            >
              Read about share cards
            </a>
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            aria-disabled={busy}
            onClick={card.download}
          >
            <ImageDown aria-hidden />
            Download PNG
          </Button>
          <Button aria-disabled={busy} onClick={card.copy}>
            <Copy aria-hidden />
            Copy image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
