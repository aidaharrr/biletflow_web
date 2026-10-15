"use client";
import Image from "next/image";
import { useCallback } from "react";
import { getTicketQr } from "@/lib/api";
import { useApiData } from "@/hooks/useApiData";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";

export function TicketQr({ id }: { id: string }) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const blob = await getTicketQr(id, { signal });
      signal.throwIfAborted();
      const url = URL.createObjectURL(blob);
      signal.addEventListener("abort", () => URL.revokeObjectURL(url), {
        once: true,
      });
      return url;
    },
    [id],
  );
  const { data, loading, error, retry } = useApiData(load);
  if (loading) return <LoadingSpinner label="Loading admission QR…" />;
  if (error || !data)
    return (
      <ErrorState
        error={error ?? new Error("QR code unavailable.")}
        retry={retry}
      />
    );
  return (
    <Image
      src={data}
      alt={`Admission QR code for ticket ${id}`}
      width={232}
      height={232}
      unoptimized
      className="mx-auto rounded-input border border-divider bg-white p-sm"
    />
  );
}
