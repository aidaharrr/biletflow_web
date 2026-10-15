"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-[36rem] rounded-card border border-divider bg-surface p-0 text-text-primary shadow-xl backdrop:bg-brand-dark/50"
    >
      <div className="max-h-[90dvh] space-y-lg overflow-y-auto p-lg sm:p-xl">
        <div className="flex items-start justify-between gap-md">
          <h2 className="font-brand text-2xl font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
            className="size-10 shrink-0 rounded-input border border-divider disabled:opacity-disabled"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
