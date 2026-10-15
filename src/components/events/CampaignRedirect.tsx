"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveCampaign } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
export function CampaignRedirect({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const controller = new AbortController();
    resolveCampaign(token, { signal: controller.signal })
      .then((campaign) =>
        router.replace(
          `/events/${encodeURIComponent(campaign.event_id)}?promo=${encodeURIComponent(campaign.promo_code)}`,
        ),
      )
      .catch((error) => {
        if (!controller.signal.aborted) setError(error);
      });
    return () => controller.abort();
  }, [token, router]);
  return error ? (
    <main className="mx-auto max-w-[32rem] px-md py-xl">
      <ErrorState error={error} />
    </main>
  ) : (
    <LoadingSpinner label="Opening your event offer…" />
  );
}
