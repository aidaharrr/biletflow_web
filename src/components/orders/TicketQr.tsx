"use client";
import Image from "next/image";
import { useCallback } from "react";
import { getTicketQr } from "@/lib/api";
import { useApiData } from "@/hooks/useApiData";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { useTranslations } from "next-intl";

export function TicketQr({ id }: { id: string }) {
  const t = useTranslations("orders");
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
  if (loading) return <LoadingSpinner label={t("TicketQr.loading")} />;
  if (error || !data)
    return (
      <ErrorState
        error={error ?? new Error(t("TicketQr.unavailable"))}
        retry={retry}
      />
    );
  return (
    <Image
      src={data}
      alt={t("TicketQr.alt", { id })}
      width={232}
      height={232}
      unoptimized
      className="mx-auto rounded-input border border-divider bg-white p-sm"
    />
  );
}
