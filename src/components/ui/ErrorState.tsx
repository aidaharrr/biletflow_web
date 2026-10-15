"use client";
import Link from "next/link";
import { Button } from "./Button";
import { ApiError, errorMessage } from "@/lib/api";

export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="space-y-md rounded-card border border-error/30 bg-error/5 p-lg"
    >
      <p className="text-error">{errorMessage(error)}</p>
      <div className="flex flex-wrap items-center gap-md">
        {retry && (
          <Button variant="outlined" onClick={retry}>
            Try again
          </Button>
        )}
        {error instanceof ApiError && error.status === 401 && (
          <Link href="/login" className="font-medium underline">
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
