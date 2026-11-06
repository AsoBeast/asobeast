import { gradeLabel, type Grade } from "@/lib/grade";
import { cn } from "@/lib/utils";

const GRADE_MARKER: Partial<Record<Grade, string>> = {
  strong: "bg-grade-strong",
  poor: "border-[1.5px] border-grade-poor",
};

const GRADE_FILL: Record<Grade, string> = {
  strong: "bg-grade-strong",
  fair: "bg-grade-fair",
  weak: "bg-grade-weak",
  poor: "bg-grade-poor",
};

const GRADE_WASH: Record<Grade, string> = {
  strong: "bg-grade-strong-subtle",
  fair: "bg-grade-fair-subtle",
  weak: "bg-grade-weak-subtle",
  poor: "bg-grade-poor-subtle",
};

export function gradeFill(value: Grade): string {
  return GRADE_FILL[value];
}

export function gradeWash(value: Grade): string {
  return GRADE_WASH[value];
}

export function GradedNumber({
  value,
  grade,
  label,
  className,
}: {
  value: string;
  grade: Grade | null;
  label: string;
  className?: string;
}) {
  const spoken = grade
    ? `${label} ${value}, ${gradeLabel(grade)}`
    : `${label} ${value}`;
  return (
    <span
      data-grade={grade ?? undefined}
      title={spoken}
      className={cn("numeric inline-flex items-center gap-1.5", className)}
    >
      <span aria-hidden>{value}</span>
      <GradeMarker grade={grade} />
      <span className="sr-only">{spoken}</span>
    </span>
  );
}

function GradeMarker({ grade }: { grade: Grade | null }) {
  const marker = grade ? GRADE_MARKER[grade] : undefined;
  if (!marker) return null;
  return (
    <span
      aria-hidden
      data-slot="grade-marker"
      className={cn("size-1.5 shrink-0 rounded-full", marker)}
    />
  );
}
