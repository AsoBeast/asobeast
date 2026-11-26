"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";
import { resolveToasterTheme } from "./sonner-theme";

const toasterStyle: NonNullable<ToasterProps["style"]> &
  Record<`--${string}`, string> = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "var(--radius-2xl)",
  pointerEvents: "auto",
};

const ABOVE_CHECKLIST_PILL =
  "in-[body:has([data-slot=checklist-pill])]:[--offset-bottom:calc(max(1rem,env(safe-area-inset-bottom))_+_3.5rem)]! in-[body:has([data-slot=checklist-pill])]:[--mobile-offset-bottom:calc(max(1rem,env(safe-area-inset-bottom))_+_3.5rem)]!";

const TOAST =
  "items-start! gap-2.5! font-sans! text-dense! shadow-overlay! data-[type=error]:pr-10! [&:not([data-type=error])>[data-close-button]]:hidden!";

const CLOSE_BUTTON =
  "top-2.5! right-2! left-auto! size-6! transform-none! rounded-md! border-0! bg-transparent! text-muted-foreground! hover:bg-muted! hover:text-foreground! focus-visible:ring-2! focus-visible:ring-ring! focus-visible:outline-none!";

const ACTION_BUTTON =
  "h-7! rounded-md! border! border-solid! border-border! bg-card! px-2.5! text-label! font-medium! text-foreground! hover:bg-muted!";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const t = useTranslations("ui");

  return (
    <Sonner
      theme={resolveToasterTheme(theme)}
      className={`toaster group ${ABOVE_CHECKLIST_PILL}`}
      closeButton
      containerAriaLabel={t("notifications")}
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-muted-foreground" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        ),
      }}
      style={toasterStyle}
      toastOptions={{
        closeButtonAriaLabel: t("dismiss"),
        classNames: {
          toast: TOAST,
          title: "font-medium! text-popover-foreground!",
          description: "text-caption! text-muted-foreground!",
          icon: "mt-0.5! mr-0!",
          closeButton: CLOSE_BUTTON,
          actionButton: ACTION_BUTTON,
          cancelButton: ACTION_BUTTON,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
