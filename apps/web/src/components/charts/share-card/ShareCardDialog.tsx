"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Copy, ImageDown, Share2, Type } from "lucide-react";
import { toast } from "sonner";
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
import { copyText } from "@/lib/copy-text";
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
    <div className="flex h-64 items-center justify-center rounded-lg bg-muted p-2 sm:h-80 sm:p-3">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        aria-busy={spec === null || undefined}
        className="h-auto max-h-full w-auto max-w-full rounded-md shadow-raised"
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
  const busy = card.busy || undefined;
  const description = headlineSentence(source.headline, card.options.change);
  const copyDescription = async () => {
    if (loading) return;
    if (await copyText(description)) toast.success("Alt text copied");
    else toast.error("The browser refused to copy the alt text");
  };
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
            A picture of this chart, ready to post.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ShareCardPreview spec={card.spec} label={description} />
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
        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            aria-disabled={loading || undefined}
            onClick={copyDescription}
          >
            <Type aria-hidden />
            Copy alt text
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
