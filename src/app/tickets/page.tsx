"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge, Button, Card } from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { listOrders, getEvent } from "@/lib/api";
import { formatKZT } from "@/lib/money";
import { useApiData } from "@/hooks/useApiData";

export default function MyTicketsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!user) return [];
      const orders = await listOrders({ signal });
      const ids = [...new Set(orders.map((order) => order.event_id))];
      const events = await Promise.all(
        ids.map((id) => getEvent(id, { signal }).catch(() => null)),
      );
      return orders.map((order) => ({
        order,
        event: events.find((event) => event?.id === order.event_id),
      }));
    },
    [user],
  );
  const { data, error, loading, retry } = useApiData(load);
  if (authLoading) return <LoadingSpinner label="Checking your account…" />;
  if (!user)
    return (
      <main className="mx-auto max-w-[32rem] px-md py-xl">
        <Card className="space-y-lg">
          <h1 className="font-brand text-2xl font-semibold">
            Your tickets, all together
          </h1>
          <p className="text-text-secondary">
            Sign in to view your orders and admission tickets.
          </p>
          <Link
            className="inline-block rounded-button bg-primary px-5 py-3.5 font-medium text-white"
            href="/login?next=%2Ftickets"
          >
            Sign in
          </Link>
        </Card>
      </main>
    );
  return (
    <main className="mx-auto max-w-5xl space-y-xl px-md py-xl sm:px-lg">
      <header className="flex flex-wrap items-start justify-between gap-lg">
        <div className="space-y-sm">
          <h1 className="font-brand text-3xl font-semibold">My tickets</h1>
          <p className="text-text-secondary">
            {user.full_name} · {user.email}
          </p>
        </div>
        <Button
          variant="outlined"
          loading={signingOut}
          onClick={async () => {
            setSigningOut(true);
            try {
              await signOut();
            } catch (error) {
              setActionError(error);
            } finally {
              setSigningOut(false);
            }
          }}
        >
          Sign out
        </Button>
      </header>
      {!!actionError && <ErrorState error={actionError} />}
      {loading ? (
        <LoadingSpinner label="Loading your orders…" />
      ) : error ? (
        <ErrorState error={error} retry={retry} />
      ) : data?.length ? (
        <div className="grid gap-lg sm:grid-cols-2">
          {data.map(({ order, event }) => (
            <Card key={order.id} className="space-y-md">
              <Badge
                variant={order.status === "confirmed" ? "success" : "neutral"}
              >
                {order.status.replace(/_/g, " ")}
              </Badge>
              <h2 className="text-title">
                {event?.title ?? `Order ${order.id.slice(0, 8)}`}
              </h2>
              <p className="text-label text-text-secondary">
                {event?.venue.name}
              </p>
              <p className="font-medium">{formatKZT(order.total_minor)}</p>
              <Link
                href={`/orders/${order.id}`}
                className="inline-block font-medium underline"
              >
                View order and tickets →
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="space-y-md">
          <h2 className="text-title">Your next experience starts here</h2>
          <p className="text-text-secondary">You don’t have any orders yet.</p>
          <Link href="/events" className="inline-block font-medium underline">
            Find an event
          </Link>
        </Card>
      )}
    </main>
  );
}
