"use client";
import { ErrorState } from "@/components/ui/ErrorState";
export default function AdminError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return <ErrorState error={error} retry={reset} />;
}
