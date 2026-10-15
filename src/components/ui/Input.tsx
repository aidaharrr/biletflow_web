"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  helperText?: string;
  error?: string;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    error,
    id,
    className,
    containerClassName,
    "aria-describedby": describedBy,
    "aria-invalid": invalid,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const descriptionIds = [describedBy, helperText && helperId, error && errorId]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("flex flex-col gap-sm", containerClassName)}>
      <label htmlFor={inputId} className="text-label text-text-secondary">
        {label}
      </label>
      <input
        {...props}
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : invalid}
        aria-describedby={descriptionIds || undefined}
        className={cn(
          "w-full rounded-input border border-border bg-surface px-[15px] py-md font-sans text-label text-text-primary placeholder:text-text-placeholder focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-disabled",
          error && "border-error focus:border-error focus:ring-error",
          className,
        )}
      />
      {helperText && (
        <p id={helperId} className="text-label text-text-secondary">
          {helperText}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-label text-error">
          {error}
        </p>
      )}
    </div>
  );
});
