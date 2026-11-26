"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { normalizeText } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addKeywords, ApiError, startSpider } from "@/lib/api";
import {
  invalidateKeywordMutation,
  keywordsOptions,
  spiderOptions,
} from "@/lib/queries";
import { spiderTermParser } from "@/lib/search-params";
import { useSingleFlight } from "@/lib/single-flight";

const PROBES_TOTAL = 27;

export function SpiderDialog({
  appId,
  country,
  children,
}: {
  appId: string;
  country: string;
  children: ReactNode;
}) {
  const t = useTranslations("keywords");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useQueryState("spider", spiderTermParser);
  const [draft, setDraft] = useState(term);

  const tracked = useQuery(keywordsOptions(appId, country));
  const trackedTexts = new Set(
    (tracked.data ?? []).map((keyword) => keyword.text),
  );

  const status = useQuery({
    ...spiderOptions(appId, term, country),
    enabled: open && term.length >= 2,
  });

  const start = useMutation({
    mutationFn: (value: string) => startSpider(appId, value, country),
    onSuccess: (_result, value) => {
      void setTerm(value);
      toast.info(
        t("spider.queued", {
          lookups: t("spider.lookups", { count: PROBES_TOTAL }),
        }),
        { description: t("spider.resultsHint") },
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : t("spider.startFailed"),
      ),
  });

  const startOnce = useSingleFlight(start);

  const track = useMutation({
    mutationFn: (text: string) => addKeywords(appId, [text], country),
    onSuccess: (_data, text) => {
      invalidateKeywordMutation(queryClient, appId);
      toast.success(t("suggestions.trackingOne", { keyword: text }));
    },
    onError: (error, text) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : t("suggestions.trackOneFailed", { keyword: text }),
      ),
  });

  function submit() {
    const value = normalizeText(draft);
    if (value.length < 2) {
      return;
    }
    startOnce(value);
  }

  const probesDone = status.data?.probesDone ?? 0;
  const complete = status.data?.complete ?? false;
  const suggestions = status.data?.suggestions ?? [];
  const active = term.length >= 2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("spider.title")}</DialogTitle>
          <DialogDescription>{t("spider.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="spider-term">{t("spider.seed")}</Label>
              <Input
                id="spider-term"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submit();
                  }
                }}
                placeholder="habit tracker"
                autoFocus
                minLength={2}
                maxLength={40}
              />
            </div>
            <Button
              onClick={submit}
              disabled={start.isPending || normalizeText(draft).length < 2}
            >
              {start.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Search />
              )}
              {t("spider.start")}
            </Button>
          </div>

          {active ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="numeric flex items-center justify-between text-caption text-muted-foreground">
                  <span>
                    {complete ? t("spider.complete") : t("spider.searching")}
                  </span>
                  <span>{`${probesDone}/${PROBES_TOTAL}`}</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={PROBES_TOTAL}
                  aria-valuenow={probesDone}
                  aria-label={t("spider.progress")}
                  className="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full bg-foreground transition-[width]"
                    style={{ width: `${(probesDone / PROBES_TOTAL) * 100}%` }}
                  />
                </div>
              </div>

              {suggestions.length === 0 ? (
                <p className="p-4 text-center text-body text-muted-foreground">
                  {complete ? t("spider.noTerms") : t("spider.waiting")}
                </p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {suggestions.map((suggestion) => {
                    const already = trackedTexts.has(suggestion.text);
                    const pending =
                      track.isPending && track.variables === suggestion.text;
                    return (
                      <li
                        key={suggestion.text}
                        className="flex items-center justify-between gap-4 py-2"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-dense font-medium">
                            {suggestion.text}
                          </span>
                          <span className="numeric flex items-center gap-2 text-caption text-muted-foreground">
                            {suggestion.priority !== null ? (
                              <span>
                                {t("spider.priority", {
                                  value: Math.round(suggestion.priority),
                                })}
                              </span>
                            ) : null}
                            <span>
                              {t("spider.probes", {
                                count: suggestion.probes,
                              })}
                            </span>
                          </span>
                        </div>
                        <Button
                          variant={already ? "ghost" : "outline"}
                          size="sm"
                          disabled={already || pending}
                          onClick={() => track.mutate(suggestion.text)}
                        >
                          {already ? (
                            <>
                              <Check />
                              {t("suggestions.tracked")}
                            </>
                          ) : pending ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <>
                              <Plus />
                              {t("suggestions.track")}
                            </>
                          )}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
