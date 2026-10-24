"use client";

import { useRef, type ReactNode, type RefObject } from "react";
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

export interface ReplyConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  cancelLabel: string;
  actionLabel: string;
  destructive?: boolean;
  textRef: RefObject<HTMLTextAreaElement | null>;
  onConfirm: () => void;
  children?: ReactNode;
}

export function ReplyConfirmDialog({
  trigger,
  title,
  description,
  cancelLabel,
  actionLabel,
  destructive = false,
  textRef,
  onConfirm,
  children,
}: ReplyConfirmDialogProps) {
  const confirmed = useRef(false);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (!confirmed.current) return;
          confirmed.current = false;
          event.preventDefault();
          textRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
          {children}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              confirmed.current = true;
              onConfirm();
            }}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
