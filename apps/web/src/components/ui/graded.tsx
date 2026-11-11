import { gradeLabel, type Grade } from "@/lib/grade";
import { cn } from "@/lib/utils";

const GRADE_MARKER: Partial<Record<Grade, string>> = {
  strong: "bg-grade-strong",
  weak: "border-[1.5px] border-grade-weak bg-linear-to-r from-grade-weak from-50% to-transparent to-50%",
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
  aligned = false,
  className,
}: {
  value: string;
  grade: Grade | null;
  label: string;
  aligned?: boolean;
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
      <GradeMarker grade={grade} reserve={aligned} />
      <span className="sr-only">{spoken}</span>
    </span>
  );
}

export function GradeMarker({
  grade,
  reserve = false,
}: {
  grade: Grade | null;
  reserve?: boolean;
}) {
  const marker = grade ? GRADE_MARKER[grade] : undefined;
  if (!marker && !reserve) return null;
  return (
    <span
      aria-hidden
      data-slot={marker ? "grade-marker" : undefined}
      className={cn("size-1.5 shrink-0 rounded-full", marker)}
    />
  );
}
