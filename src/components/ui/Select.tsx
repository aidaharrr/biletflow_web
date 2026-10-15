"use client";
import {
  useId,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";
const style =
  "w-full min-h-button rounded-input border border-border bg-surface px-3 py-3 text-label text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-disabled";
export function Select({
  label,
  id,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const generated = useId();
  const field = id ?? generated;
  return (
    <div className="min-w-0 space-y-sm">
      <label htmlFor={field} className="block text-label text-text-secondary">
        {label}
      </label>
      <select id={field} className={cn(style, className)} {...props}>
        {children}
      </select>
    </div>
  );
}
export function Textarea({
  label,
  id,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const generated = useId();
  const field = id ?? generated;
  return (
    <div className="space-y-sm">
      <label htmlFor={field} className="block text-label text-text-secondary">
        {label}
      </label>
      <textarea
        id={field}
        className={cn(style, "min-h-28", className)}
        {...props}
      />
    </div>
  );
}
