import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

const WIDTH = { form: "max-w-90", wall: "max-w-100" } as const;

export const INLINE_LINK = "text-foreground link-underline";

interface AuthCardProps {
  title: string;
  titleRef?: Ref<HTMLHeadingElement>;
  description?: ReactNode;
  announce?: boolean;
  footer?: ReactNode;
  width?: keyof typeof WIDTH;
  className?: string;
  children?: ReactNode;
}

export function AuthCard({
  title,
  titleRef,
  description,
  announce = false,
  footer,
  width = "form",
  className,
  children,
}: AuthCardProps) {
  return (
    <div
      className={cn("mx-auto flex w-full flex-col", WIDTH[width], className)}
    >
      <div className="flex flex-col gap-2 text-center text-balance">
        <h1
          ref={titleRef}
          tabIndex={titleRef ? -1 : undefined}
          className="text-title outline-none"
        >
          {title}
        </h1>
        {description ? (
          <p
            role={announce ? "status" : undefined}
            className="text-body text-muted-foreground"
          >
            {description}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="mt-6 flex flex-col gap-4">{children}</div>
      ) : null}
      {footer ? (
        <p className="mt-4 text-center text-dense text-muted-foreground">
          {footer}
        </p>
      ) : null}
    </div>
  );
}

export function AuthPanel({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border bg-card p-6">{children}</div>;
}

export function AuthActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {children}
    </div>
  );
}

export function AuthAside({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 border-t pt-4 text-center text-balance text-muted-foreground">
      {children}
    </div>
  );
}
