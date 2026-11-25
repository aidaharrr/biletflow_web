"use client";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAuth } from "@/components/auth/AuthProvider";
import { EventBanner } from "./EventBanner";
import { CheckoutModal } from "./CheckoutModal";
import { RequestSupport } from "@/components/support/RequestSupport";
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
import { useTranslations } from "next-intl";
import { useIntlLocale, useLabel } from "@/i18n/labels";

export function EventDetails({
  id,
  initialPromoCode = "",
  initialItems = [],
}: {
  id: string;
  initialPromoCode?: string;
  initialItems?: CheckoutItem[];
}) {
  const t = useTranslations("events");
  const label = useLabel();
  const locale = useIntlLocale();
  const money = (amount: number) => formatKZT(amount);
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
  if (resource.loading)
    return <LoadingSpinner label={t("EventLoading.label")} />;
  if (resource.error || !event)
    return (
      <main className="mx-auto max-w-4xl px-md py-xl">
        <ErrorState
          error={resource.error ?? new Error(t("EventDetails.unavailable"))}
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
        {t("EventDetails.allEvents")}
      </Link>
      <EventBanner
        event={event}
        priority
        className="aspect-[16/6] min-h-48 rounded-card"
      />
      <div className="grid items-start gap-xl lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-xl">
          <header className="space-y-md">
            <Badge className="capitalize">{label(event.category)}</Badge>
            <h1 className="font-brand text-3xl font-semibold sm:text-4xl">
              {event.title}
            </h1>
            <p className="text-text-secondary">
              <time dateTime={event.starts_at}>{eventDate(event, locale)}</time>{" "}
              · {event.time_zone}
            </p>
            <p className="text-text-secondary">
              {event.venue.name} · {event.venue.city}
            </p>
            {event.status === "cancelled" && (
              <Badge variant="error">{t("EventDetails.cancelled")}</Badge>
            )}
          </header>
          <section className="space-y-md">
            <h2 className="text-title">{t("EventDetails.about")}</h2>
            <p className="whitespace-pre-wrap leading-relaxed text-text-secondary">
              {event.description}
            </p>
          </section>
          <Card className="space-y-sm">
            <h2 className="text-title">{t("EventDetails.host")}</h2>
            <p>{event.organizer_name || t("EventDetails.organizerFallback")}</p>
            <p className="text-label text-text-secondary">
              {t("EventDetails.hostQuestion")}
            </p>
            <RequestSupport
              eventId={event.id}
              eventTitle={event.title}
              label={t("EventDetails.contactOrganizer")}
            />
          </Card>
          <section className="space-y-md">
            <h2 className="text-title">{t("EventDetails.whereToMeet")}</h2>
            <p>{event.venue.name}</p>
            <p className="text-text-secondary">{event.venue.address}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue.name} ${event.venue.address}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-label font-medium underline"
            >
              {t("EventDetails.viewMap")}
            </a>
          </section>
          <section className="space-y-md">
            <h2 className="text-title">{t("EventDetails.refundPolicy")}</h2>
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
              {t("EventDetails.addToCalendar")}
            </Button>
            {!!calendarError && <ErrorState error={calendarError} />}
          </section>
        </div>
        <Card className="space-y-lg lg:sticky lg:top-lg">
          <h2 className="text-title">{t("EventDetails.chooseTickets")}</h2>
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
                    <Badge>
                      {type.kind === "free"
                        ? t("EventDetails.free")
                        : t("EventDetails.paid")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-md">
                    <p className="font-medium">
                      {type.kind === "free"
                        ? t("EventDetails.free")
                        : money(type.price_minor)}
                    </p>
                    <div
                      role="group"
                      aria-label={t("EventDetails.quantityFor", {
                        name: type.name,
                      })}
                      className="flex items-center gap-md"
                    >
                      <button
                        type="button"
                        aria-label={t("EventDetails.removeTicket", {
                          name: type.name,
                        })}
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
                        aria-label={t("EventDetails.addTicket", {
                          name: type.name,
                        })}
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
                    {availability.reason
                      ? label(availability.reason)
                      : t("EventDetails.availability", {
                          remaining: availability.remaining,
                          max: type.max_per_order,
                        })}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-text-secondary">
              {t("EventDetails.ticketsUnavailable")}
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
              label={t("EventDetails.promoLabel")}
              value={promoDraft}
              onChange={(change) => setPromoDraft(change.target.value)}
              placeholder={t("EventDetails.promoPlaceholder")}
              disabled={checkout}
            />
            <Button
              type="submit"
              variant="outlined"
              className="w-full"
              disabled={!items.length || !user || checkout}
              loading={!!items.length && !!user && quote.loading}
            >
              {t("EventDetails.applyPromo")}
            </Button>
            {initialPromoCode && (
              <p className="text-label text-text-secondary">
                {t("EventDetails.campaignCode", { code: initialPromoCode })}
              </p>
            )}
            {!user && promoDraft && (
              <p className="text-label text-text-secondary">
                {t("EventDetails.signInToValidate")}
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
              {t.rich(
                quote.data.campaign_name
                  ? "EventDetails.promoAppliedCampaign"
                  : "EventDetails.promoApplied",
                {
                  code: quote.data.promo_code,
                  campaign: quote.data.campaign_name ?? "",
                  amount: money(quote.data.discount_minor),
                  strong: (chunks) => <strong>{chunks}</strong>,
                },
              )}
            </p>
          )}
          <dl className="space-y-sm text-label">
            <div className="flex justify-between">
              <dt>{t("EventDetails.tickets")}</dt>
              <dd>{items.reduce((sum, item) => sum + item.quantity, 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t("EventDetails.subtotal")}</dt>
              <dd>{money(quote.data?.subtotal_minor ?? subtotal)}</dd>
            </div>
            {quote.data && (
              <>
                <div className="flex justify-between">
                  <dt>
                    {quote.data.promo_code
                      ? t("EventDetails.discountWithCode", {
                          code: quote.data.promo_code,
                        })
                      : t("EventDetails.discount")}
                  </dt>
                  <dd>−{money(quote.data.discount_minor)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t("EventDetails.processingFee")}</dt>
                  <dd>{money(quote.data.processing_fee_minor)}</dd>
                </div>
              </>
            )}
            <div className="flex justify-between border-t border-divider pt-md text-lg font-semibold">
              <dt>
                {quote.data
                  ? t("EventDetails.total")
                  : t("EventDetails.estimatedSubtotal")}
              </dt>
              <dd>{money(quote.data?.total_minor ?? subtotal)}</dd>
            </div>
          </dl>
          {!quote.data && (
            <p className="text-label text-text-secondary">
              {t("EventDetails.finalFeesNote")}
            </p>
          )}
          {invalidSelection && (
            <p role="alert" className="text-label text-error">
              {t("EventDetails.availabilityChanged")}
            </p>
          )}
          {!authLoading && !user && items.length > 0 ? (
            <Link
              className="block rounded-button bg-primary px-5 py-3.5 text-center font-medium text-white"
              href={`/login?next=${encodeURIComponent(next)}`}
            >
              {t("EventDetails.signInToCheckout")}
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
              {t("EventDetails.proceed")}
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
