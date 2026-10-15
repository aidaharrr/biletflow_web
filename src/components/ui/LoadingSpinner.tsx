export function LoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-sm py-xl text-text-secondary"
    >
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-divider border-t-primary motion-reduce:animate-none"
      />
      {label}
    </div>
  );
}
