"use client";
import { ErrorState } from "@/components/ui/ErrorState";
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-xl">
      <ErrorState error={error} retry={reset} />
    </div>
  );
}
