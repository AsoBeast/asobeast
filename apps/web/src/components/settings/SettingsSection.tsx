import type { ReactNode } from "react";

export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="flex scroll-mt-20 flex-col gap-3"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id={`${id}-heading`} className="text-title tracking-tight">
          {title}
        </h2>
        <p className="text-body text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
