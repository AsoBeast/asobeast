"use client";

import { useTheme } from "next-themes";
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
  "--success-bg": "var(--popover)",
  "--success-text": "var(--success)",
  "--success-border": "var(--success)",
  "--warning-bg": "var(--popover)",
  "--warning-text": "var(--warning)",
  "--warning-border": "var(--warning)",
  "--error-bg": "var(--popover)",
  "--error-text": "var(--destructive)",
  "--error-border": "var(--destructive)",
  "--border-radius": "var(--radius)",
  boxShadow: "var(--elevation-overlay)",
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={resolveToasterTheme(theme)}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={toasterStyle}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
