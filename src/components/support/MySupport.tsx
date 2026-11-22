"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  SupportThread,
  statusLabel,
} from "@/components/organizer/SupportInbox";
import { Badge, Button, Card } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { usePollingData } from "@/hooks/usePollingData";
import { listSupportCases } from "@/lib/api";
import { dateLabel } from "@/lib/organizer";

/** Attendee view of their own support requests and the replies to them. */
export function MySupport({ initialCase = "" }: { initialCase?: string }) {
  const { user, loading: authLoading } = useAuth();
  const [selected, setSelected] = useState(initialCase);
  const load = useCallback(
    (signal: AbortSignal) =>
      user
        ? listSupportCases({
            signal,
            params: { view: "mine", flow: "attendee" },
          })
        : Promise.resolve([]),
    [user],
  );
  const resource = usePollingData(load, 30000);
  if (authLoading) return <LoadingSpinner label="Checking your account…" />;
  if (!user)
    return (
      <main className="mx-auto max-w-[32rem] px-md py-xl">
        <Card className="space-y-lg">
          <h1 className="font-brand text-2xl font-semibold">
            Support requests
          </h1>
          <p className="text-text-secondary">
            Sign in to see your support requests.
          </p>
          <Link
            className="inline-block rounded-button bg-primary px-5 py-3.5 font-medium text-white"
            href="/login?next=%2Fsupport"
          >
            Sign in
          </Link>
        </Card>
      </main>
    );
  const cases = resource.data ?? [];
  const active = cases.find((item) => item.id === selected) ?? cases[0];
  return (
    <main className="mx-auto max-w-6xl space-y-xl px-md py-xl sm:px-lg">
      <header className="space-y-sm">
        <h1 className="font-brand text-3xl font-semibold">Support requests</h1>
        <p className="text-label text-text-secondary">
          To open a new request, use “Request support” on an event, order or
          ticket page. Replies refresh automatically.
        </p>
      </header>
      {resource.loading ? (
        <LoadingSpinner label="Loading your support requests…" />
      ) : !resource.data ? (
        <ErrorState error={resource.error} retry={resource.retry} />
      ) : !cases.length ? (
        <Card className="space-y-md">
          <h2 className="text-title">No support requests yet</h2>
          <p className="text-text-secondary">
            Need help with a booking? Open it from{" "}
            <Link href="/tickets" className="underline">
              My Tickets
            </Link>{" "}
            and choose “Request support”.
          </p>
        </Card>
      ) : (
        <div className="grid items-start gap-lg lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="space-y-md">
            <div className="flex items-center justify-between gap-sm">
              <h2 className="text-title">Requests ({cases.length})</h2>
              <Button
                variant="text"
                className="px-sm text-label"
                loading={resource.refreshing}
                onClick={resource.retry}
              >
                Refresh
              </Button>
            </div>
            <div className="max-h-[650px] space-y-sm overflow-y-auto">
              {cases.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelected(item.id)}
                  aria-pressed={active?.id === item.id}
                  className={`w-full rounded-input border p-md text-left ${active?.id === item.id ? "border-primary bg-primary/5" : "border-divider hover:bg-background"}`}
                >
                  <span className="block break-words text-label font-medium">
                    {item.subject}
                  </span>
                  <span className="mt-sm block text-label text-text-secondary">
                    {item.event_title ?? "General support"}
                  </span>
                  <span className="mt-sm block">
                    <Badge
                      variant={
                        item.status === "resolved" ? "success" : "neutral"
                      }
                    >
                      {statusLabel(item.status)}
                    </Badge>
                  </span>
                  <span className="mt-sm block text-label text-text-secondary">
                    {dateLabel(item.updated_at)}
                  </span>
                </button>
              ))}
            </div>
          </Card>
          {active && (
            <SupportThread
              key={active.id}
              supportCase={active}
              onUpdated={resource.retry}
            />
          )}
        </div>
      )}
      {!!resource.error && !!resource.data && (
        <ErrorState error={resource.error} retry={resource.retry} />
      )}
    </main>
  );
}
