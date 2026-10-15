"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outlined" | "text";
  loading?: boolean;
  loadingLabel?: string;
}

const variants = {
  primary: "border-primary bg-primary text-white enabled:hover:brightness-95",
  outlined:
    "border-text-primary bg-surface text-text-primary enabled:hover:bg-background",
  text: "border-transparent bg-transparent text-primary enabled:hover:bg-primary/5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      loading = false,
      loadingLabel = "Loading",
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex min-h-button items-center justify-center gap-sm rounded-button border px-5 py-3.5 font-sans text-button transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-disabled",
          variants[variant],
          className,
        )}
      >
        {loading && (
          <>
            <span
              aria-hidden="true"
              className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
            />
            <span role="status" className="sr-only">
              {loadingLabel}
            </span>
          </>
        )}
        {children}
      </button>
    );
  },
);
