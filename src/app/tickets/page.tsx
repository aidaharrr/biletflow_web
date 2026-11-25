"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge, Button, Card } from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { listOrders, getEvent } from "@/lib/api";
import { formatKZT } from "@/lib/money";
import { RequestSupport } from "@/components/support/RequestSupport";
import { useApiData } from "@/hooks/useApiData";
import { useTranslations } from "next-intl";

export default function MyTicketsPage() {
  const t = useTranslations("orders");
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
  if (authLoading)
    return <LoadingSpinner label={t("TicketsPage.checkingAccount")} />;
  if (!user)
    return (
      <main className="mx-auto max-w-[32rem] px-md py-xl">
        <Card className="space-y-lg">
          <h1 className="font-brand text-2xl font-semibold">
            {t("TicketsPage.signedOutTitle")}
          </h1>
          <p className="text-text-secondary">
            {t("TicketsPage.signedOutBody")}
          </p>
          <Link
            className="inline-block rounded-button bg-primary px-5 py-3.5 font-medium text-white"
            href="/login?next=%2Ftickets"
          >
            {t("TicketsPage.signIn")}
          </Link>
        </Card>
      </main>
    );
  return (
    <main className="mx-auto max-w-5xl space-y-xl px-md py-xl sm:px-lg">
      <header className="flex flex-wrap items-start justify-between gap-lg">
        <div className="space-y-sm">
          <h1 className="font-brand text-3xl font-semibold">
            {t("TicketsPage.title")}
          </h1>
          <p className="text-text-secondary">
            {user.full_name} · {user.email}
          </p>
          <Link href="/support" className="inline-block text-label underline">
            {t("TicketsPage.supportLink")}
          </Link>
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
          {t("TicketsPage.signOut")}
        </Button>
      </header>
      {!!actionError && <ErrorState error={actionError} />}
      {loading ? (
        <LoadingSpinner label={t("TicketsPage.loading")} />
      ) : error ? (
        <ErrorState error={error} retry={retry} />
      ) : data?.length ? (
        <div className="grid gap-lg sm:grid-cols-2">
          {data.map(({ order, event }) => (
            <Card key={order.id} className="space-y-md">
              <Badge
                variant={order.status === "confirmed" ? "success" : "neutral"}
              >
                {t.has(`OrderStatus.${order.status}`)
                  ? t(`OrderStatus.${order.status}`)
                  : order.status.replace(/_/g, " ")}
              </Badge>
              <h2 className="text-title">
                {event?.title ??
                  t("TicketsPage.orderFallback", { id: order.id.slice(0, 8) })}
              </h2>
              <p className="text-label text-text-secondary">
                {event?.venue.name}
              </p>
              <p className="font-medium">{formatKZT(order.total_minor)}</p>
              <div className="flex flex-wrap items-center gap-md">
                <Link
                  href={`/orders/${order.id}`}
                  className="inline-block font-medium underline"
                >
                  {t("TicketsPage.viewOrder")}
                </Link>
                <RequestSupport
                  eventId={order.event_id}
                  eventTitle={event?.title}
                  orderId={order.id}
                  label={t("TicketsPage.getHelp")}
                  variant="text"
                />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="space-y-md">
          <h2 className="text-title">{t("TicketsPage.emptyTitle")}</h2>
          <p className="text-text-secondary">{t("TicketsPage.emptyBody")}</p>
          <Link href="/events" className="inline-block font-medium underline">
            {t("TicketsPage.findEvent")}
          </Link>
        </Card>
      )}
    </main>
  );
}
