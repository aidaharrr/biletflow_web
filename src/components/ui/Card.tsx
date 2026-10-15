import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-card border border-divider bg-surface p-lg shadow-card",
        className,
      )}
    />
  );
}
