"use client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAuth } from "@/components/auth/AuthProvider";
import { EventBanner } from "./EventBanner";
import { CheckoutModal } from "./CheckoutModal";
import {
  getEvent,
  listTicketTypes,
  validatePromoCode,
  ApiError,
} from "@/lib/api";
import { eventDate, ticketAvailability } from "@/lib/events";
import { formatKZT } from "@/lib/money";
import { downloadCalendar } from "@/lib/calendar";
import { useApiData } from "@/hooks/useApiData";
import type { CheckoutItem } from "@/types/api";

export function EventDetails({
  id,
  initialPromoCode = "",
  initialItems = [],
}: {
  id: string;
  initialPromoCode?: string;
  initialItems?: CheckoutItem[];
}) {
  const { user, loading: authLoading } = useAuth();
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      initialItems.map((item) => [item.ticket_type_id, item.quantity]),
    ),
  );
  const [promoDraft, setPromoDraft] = useState(initialPromoCode);
  const [promoCode, setPromoCode] = useState(
    initialPromoCode.trim().toUpperCase(),
  );
  const [checkout, setCheckout] = useState(false);
  const [calendarError, setCalendarError] = useState<unknown>(null);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const event = await getEvent(id, { signal });
      const types =
        event.status === "published"
          ? await listTicketTypes(id, { signal })
          : event.available_ticket_types;
      return {
        ...event,
        available_ticket_types: types.filter((type) => !type.is_hidden),
      };
    },
    [id],
  );
  const resource = useApiData(load);
  const event = resource.data;
  const items = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([ticket_type_id, quantity]) => ({ ticket_type_id, quantity })),
    [quantities],
  );
  const quoteLoad = useCallback(
    (signal: AbortSignal) =>
      user && items.length
        ? validatePromoCode(id, items, promoCode, { signal })
        : Promise.resolve(null),
    [user, id, items, promoCode],
  );
  const quote = useApiData(quoteLoad);
  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      (event?.available_ticket_types.find(
        (type) => type.id === item.ticket_type_id,
      )?.price_minor ?? 0) *
        item.quantity,
    0,
  );
  if (resource.loading) return <LoadingSpinner label="Loading event…" />;
  if (resource.error || !event)
    return (
      <main className="mx-auto max-w-4xl px-md py-xl">
        <ErrorState
          error={resource.error ?? new Error("Event unavailable.")}
          retry={resource.retry}
        />
      </main>
    );
  const invalidSelection = items.some((item) => {
    const type = event.available_ticket_types.find(
      (type) => type.id === item.ticket_type_id,
    );
    return !type || item.quantity > ticketAvailability(type, event).limit;
  });
  const validationUnavailable =
    quote.error instanceof ApiError && [404, 405].includes(quote.error.status);
  const nextQuery = new URLSearchParams({
    tickets: JSON.stringify(items),
    ...(promoCode ? { promo: promoCode } : {}),
  });
  const next = `/events/${encodeURIComponent(id)}?${nextQuery}`;
  return (
    <main className="mx-auto max-w-7xl space-y-xl px-md py-xl sm:px-lg lg:px-xl">
      <Link
        href="/events"
        className="text-label text-text-secondary hover:text-primary"
      >
        ← All events
      </Link>
      <EventBanner
        event={event}
        priority
        className="aspect-[16/6] min-h-48 rounded-card"
      />
      <div className="grid items-start gap-xl lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-xl">
          <header className="space-y-md">
            <Badge className="capitalize">{event.category}</Badge>
            <h1 className="font-brand text-3xl font-semibold sm:text-4xl">
              {event.title}
            </h1>
            <p className="text-text-secondary">
              <time dateTime={event.starts_at}>{eventDate(event)}</time> ·{" "}
              {event.time_zone}
            </p>
            <p className="text-text-secondary">
              {event.venue.name} · {event.venue.city}
            </p>
            {event.status === "cancelled" && (
              <Badge variant="error">Event cancelled</Badge>
            )}
          </header>
          <section className="space-y-md">
            <h2 className="text-title">About this event</h2>
            <p className="whitespace-pre-wrap leading-relaxed text-text-secondary">
              {event.description}
            </p>
          </section>
          <Card className="space-y-sm">
            <h2 className="text-title">Your host</h2>
            <p>{event.organizer_name || "Event organizer"}</p>
          </Card>
          <section className="space-y-md">
            <h2 className="text-title">Where to meet</h2>
            <p>{event.venue.name}</p>
            <p className="text-text-secondary">{event.venue.address}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue.name} ${event.venue.address}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-label font-medium underline"
            >
              View location on map ↗
            </a>
          </section>
          <section className="space-y-md">
            <h2 className="text-title">Refund policy</h2>
            <p className="whitespace-pre-wrap text-label text-text-secondary">
              {event.refund_policy}
            </p>
            <Button
              variant="outlined"
              onClick={() => {
                try {
                  downloadCalendar(event);
                } catch (error) {
                  setCalendarError(error);
                }
              }}
            >
              Add to Calendar
            </Button>
            {!!calendarError && <ErrorState error={calendarError} />}
          </section>
        </div>
        <Card className="space-y-lg lg:sticky lg:top-lg">
          <h2 className="text-title">Choose your tickets</h2>
          {event.available_ticket_types.length ? (
            event.available_ticket_types.map((type) => {
              const availability = ticketAvailability(type, event);
              const quantity = quantities[type.id] ?? 0;
              return (
                <div
                  key={type.id}
                  className="space-y-md border-b border-divider pb-lg"
                >
                  <div className="flex items-start justify-between gap-md">
                    <div>
                      <h3 className="font-medium">{type.name}</h3>
                      <p className="mt-xs text-label text-text-secondary">
                        {type.description}
                      </p>
                    </div>
                    <Badge>{type.kind === "free" ? "Free" : "Paid"}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-md">
                    <p className="font-medium">
                      {type.kind === "free"
                        ? "Free"
                        : formatKZT(type.price_minor)}
                    </p>
                    <div
                      role="group"
                      aria-label={`Quantity for ${type.name}`}
                      className="flex items-center gap-md"
                    >
                      <button
                        type="button"
                        aria-label={`Remove ${type.name} ticket`}
                        disabled={!quantity || checkout}
                        onClick={() =>
                          setQuantities((value) => ({
                            ...value,
                            [type.id]: Math.max(0, quantity - 1),
                          }))
                        }
                        className="size-11 rounded-input border border-divider disabled:opacity-disabled"
                      >
                        −
                      </button>
                      <output
                        aria-live="polite"
                        className="min-w-4 text-center"
                      >
                        {quantity}
                      </output>
                      <button
                        type="button"
                        aria-label={`Add ${type.name} ticket`}
                        disabled={quantity >= availability.limit || checkout}
                        onClick={() =>
                          setQuantities((value) => ({
                            ...value,
                            [type.id]: quantity + 1,
                          }))
                        }
                        className="size-11 rounded-input border border-divider disabled:opacity-disabled"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="text-label text-text-secondary">
                    {availability.reason ??
                      `${availability.remaining} available · Max ${type.max_per_order} per order`}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-text-secondary">
              Tickets are not available yet.
            </p>
          )}
          <form
            className="space-y-sm"
            onSubmit={(submit) => {
              submit.preventDefault();
              setPromoCode(promoDraft.trim().toUpperCase());
              quote.retry();
            }}
          >
            <Input
              label="Promo code"
              value={promoDraft}
              onChange={(change) => setPromoDraft(change.target.value)}
              placeholder="Enter your code"
              disabled={checkout}
            />
            <Button
              type="submit"
              variant="outlined"
              className="w-full"
              disabled={!items.length || !user || checkout}
              loading={!!items.length && !!user && quote.loading}
            >
              Apply promo code
            </Button>
            {initialPromoCode && (
              <p className="text-label text-text-secondary">
                Campaign code: {initialPromoCode}. It will be checked against
                your selection.
              </p>
            )}
            {!user && promoDraft && (
              <p className="text-label text-text-secondary">
                Sign in to validate your discount.
              </p>
            )}
          </form>
          {!!quote.error && !validationUnavailable && (
            <ErrorState error={quote.error} retry={quote.retry} />
          )}
          {quote.data?.promo_code && (
            <p
              role="status"
              className="rounded-input border border-success/30 bg-success/10 p-md text-label"
            >
              ✓ Code <strong>{quote.data.promo_code}</strong> applied
              {quote.data.campaign_name ? ` (${quote.data.campaign_name})` : ""}
              : you save {formatKZT(quote.data.discount_minor)}.
            </p>
          )}
          <dl className="space-y-sm text-label">
            <div className="flex justify-between">
              <dt>Tickets</dt>
              <dd>{items.reduce((sum, item) => sum + item.quantity, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatKZT(quote.data?.subtotal_minor ?? subtotal)}</dd>
            </div>
            {quote.data && (
              <>
                <div className="flex justify-between">
                  <dt>
                    Discount
                    {quote.data.promo_code ? ` (${quote.data.promo_code})` : ""}
                  </dt>
                  <dd>−{formatKZT(quote.data.discount_minor)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Processing fee</dt>
                  <dd>{formatKZT(quote.data.processing_fee_minor)}</dd>
                </div>
              </>
            )}
            <div className="flex justify-between border-t border-divider pt-md text-lg font-semibold">
              <dt>{quote.data ? "Total" : "Estimated subtotal"}</dt>
              <dd>{formatKZT(quote.data?.total_minor ?? subtotal)}</dd>
            </div>
          </dl>
          {!quote.data && (
            <p className="text-label text-text-secondary">
              Final fees and discounts are confirmed before you complete
              checkout.
            </p>
          )}
          {invalidSelection && (
            <p role="alert" className="text-label text-error">
              Availability has changed. Please update your selection.
            </p>
          )}
          {!authLoading && !user && items.length > 0 ? (
            <Link
              className="block rounded-button bg-primary px-5 py-3.5 text-center font-medium text-white"
              href={`/login?next=${encodeURIComponent(next)}`}
            >
              Sign in to checkout
            </Link>
          ) : (
            <Button
              className="w-full"
              disabled={
                !items.length ||
                authLoading ||
                invalidSelection ||
                (quote.loading && !!user) ||
                (!!quote.error && !validationUnavailable)
              }
              onClick={() => setCheckout(true)}
            >
              Proceed to Checkout
            </Button>
          )}
        </Card>
      </div>
      {checkout && user && (
        <CheckoutModal
          event={event}
          items={items}
          promoCode={promoCode}
          user={user}
          onClose={() => {
            setCheckout(false);
            resource.retry();
          }}
        />
      )}
    </main>
  );
}
