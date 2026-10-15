import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "success" | "error";
}

const variants = {
  neutral: "border-border bg-surface text-text-primary",
  success: "border-success/30 bg-success/10 text-text-primary",
  error: "border-error/30 bg-error/10 text-error",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center rounded-badge border px-3.5 py-sm font-sans text-badge",
        variants[variant],
        className,
      )}
    />
  );
}
