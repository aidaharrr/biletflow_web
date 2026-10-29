"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveCampaign } from "@/lib/api";
import { Card } from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import type { CampaignResolution } from "@/types/api";
export function CampaignRedirect({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [unavailable, setUnavailable] = useState<CampaignResolution | null>(
    null,
  );
  useEffect(() => {
    const controller = new AbortController();
    resolveCampaign(token, { signal: controller.signal })
      .then((campaign) => {
        // The server only returns a code while it is usable; checkout re-validates it.
        if (campaign.promo_code)
          router.replace(
            `/events/${encodeURIComponent(campaign.event_id)}?promo=${encodeURIComponent(campaign.promo_code)}`,
          );
        else setUnavailable(campaign);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error);
      });
    return () => controller.abort();
  }, [token, router]);
  if (error)
    return (
      <main className="mx-auto max-w-[32rem] px-md py-xl">
        <ErrorState error={error} />
      </main>
    );
  if (unavailable)
    return (
      <main className="mx-auto max-w-[32rem] px-md py-xl">
        <Card className="space-y-md">
          <h1 className="font-brand text-2xl font-semibold">
            {unavailable.event_title}
          </h1>
          <p role="status" className="text-text-secondary">
            {unavailable.message ?? "This promotion is not available."}
          </p>
          <Link
            href={`/events/${encodeURIComponent(unavailable.event_id)}`}
            className="block rounded-button bg-primary px-5 py-3.5 text-center font-medium text-white"
          >
            View event without the promotion
          </Link>
        </Card>
      </main>
    );
  return <LoadingSpinner label="Opening your event offer…" />;
}
