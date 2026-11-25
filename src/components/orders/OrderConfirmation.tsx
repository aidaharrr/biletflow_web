"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { RequestSupport } from "@/components/support/RequestSupport";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { TicketQr } from "./TicketQr";
import {
  getOrder,
  getEvent,
  listTickets,
  resendOrderConfirmation,
  ApiError,
} from "@/lib/api";
import { formatKZT } from "@/lib/money";
import { eventDate } from "@/lib/events";
import { downloadCalendar } from "@/lib/calendar";
import { printTicket } from "@/lib/print-ticket";
import { useApiData } from "@/hooks/useApiData";
import type { Ticket } from "@/types/api";
import { useTranslations } from "next-intl";
import { useErrorText, useIntlLocale } from "@/i18n/labels";

export function OrderConfirmation({ id }: { id: string }) {
  const t = useTranslations("orders");
  const errorText = useErrorText();
  const locale = useIntlLocale();
  const money = (amount: number) => formatKZT(amount);
  const orderStatus = (status: string) =>
    t.has(`OrderStatus.${status}`)
      ? t(`OrderStatus.${status}`)
      : status.replace(/_/g, " ");
  const ticketStatus = (status: string) =>
    t.has(`TicketStatus.${status}`)
      ? t(`TicketStatus.${status}`)
      : status.replace(/_/g, " ");
  const load = useCallback(
    async (signal: AbortSignal) => {
      const order = await getOrder(id, { signal });
      const event = await getEvent(order.event_id, { signal });
      let tickets = order.tickets;
      let ticketError: unknown = null;
      if (
        tickets === undefined &&
        ["confirmed", "partially_refunded", "refunded", "cancelled"].includes(
          order.status,
        )
      ) {
        try {
          const owned = await listTickets({ signal });
          if (owned.some((ticket) => ticket.order_id === undefined))
            throw new Error(t("OrderConfirmation.ticketDetailsUnavailable"));
          tickets = owned.filter((ticket) => ticket.order_id === order.id);
        } catch (error) {
          ticketError = error;
        }
      }
      return { order, event, tickets: tickets ?? [], ticketError };
    },
    [id, t],
  );
  const { data, loading, error, retry } = useApiData(load);
  const [actionError, setActionError] = useState<unknown>(null);
  const [printing, setPrinting] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState<string | null>(null);
  if (loading) return <LoadingSpinner label={t("OrderConfirmation.loading")} />;
  if (error || !data)
    return (
      <main className="mx-auto max-w-4xl px-md py-xl">
        <ErrorState
          error={error ?? new Error(t("OrderConfirmation.unavailable"))}
          retry={retry}
        />
        {error instanceof ApiError && error.status === 401 && (
          <Link
            className="mt-lg inline-block underline"
            href={`/login?next=${encodeURIComponent(`/orders/${id}`)}`}
          >
            {t("OrderConfirmation.signInToView")}
          </Link>
        )}
      </main>
    );
  const { order, event, tickets, ticketError } = data;
  const confirmed = order.status === "confirmed";
  async function resend() {
    setResending(true);
    setActionError(null);
    try {
      const result = await resendOrderConfirmation(order.id);
      setResent(
        result?.message
          ? errorText(result.message)
          : t("OrderConfirmation.ticketsSent", { email: order.attendee_email }),
      );
    } catch (error) {
      setActionError(error);
    } finally {
      setResending(false);
    }
  }
  async function openPrint(ticket: Ticket) {
    if (!data) return;
    setPrinting(ticket.id);
    setActionError(null);
    try {
      await printTicket(
        ticket,
        data.event,
        data.event.available_ticket_types.find(
          (type) => type.id === ticket.ticket_type_id,
        ),
        {
          locale,
          popupBlocked: t("PrintTicket.popupBlocked"),
          documentTitle: (id) => t("PrintTicket.documentTitle", { id }),
          preparing: t("PrintTicket.preparing"),
          heading: t("PrintTicket.heading"),
          attendee: (name) => t("PrintTicket.attendee", { name }),
          ticketType: (name) => t("PrintTicket.ticketType", { name }),
          admissionFallback: t("PrintTicket.admissionFallback"),
          seat: (seat) => t("PrintTicket.seat", { seat }),
          status: (status) =>
            t("PrintTicket.status", { status: ticketStatus(status) }),
          ticketId: (id) => t("PrintTicket.ticketId", { id }),
          qrAlt: (id) => t("PrintTicket.qrAlt", { id }),
          footer: t("PrintTicket.footer"),
          print: t("PrintTicket.print"),
          download: t("PrintTicket.download"),
        },
      );
    } catch (error) {
      setActionError(error);
    } finally {
      setPrinting(null);
    }
  }
  return (
    <main className="mx-auto max-w-5xl space-y-xl px-md py-xl sm:px-lg">
      <header className="space-y-md">
        <Badge
          variant={
            confirmed
              ? "success"
              : ["refunded", "cancelled", "payment_failed", "expired"].includes(
                    order.status,
                  )
                ? "error"
                : "neutral"
          }
        >
          {orderStatus(order.status)}
        </Badge>
        <h1 className="font-brand text-3xl font-semibold">
          {confirmed
            ? t("OrderConfirmation.headingConfirmed")
            : t("OrderConfirmation.headingDefault")}
        </h1>
        <p className="text-text-secondary">{event.title}</p>
        <p className="text-label text-text-secondary">
          {t("OrderConfirmation.orderNumber", { id: order.id })}
        </p>
      </header>
      {!confirmed && (
        <Card>
          <p>
            {order.status === "pending"
              ? t("OrderConfirmation.pendingNote")
              : t("OrderConfirmation.checkStatusNote")}
          </p>
        </Card>
      )}
      <div className="grid items-start gap-lg md:grid-cols-2">
        <Card className="space-y-md">
          <h2 className="text-title">{t("OrderConfirmation.yourEvent")}</h2>
          <p>{event.title}</p>
          <p className="text-label text-text-secondary">
            {eventDate(event, locale)} · {event.time_zone}
          </p>
          <p className="text-label text-text-secondary">
            {event.venue.name}, {event.venue.address}
          </p>
          <p className="text-label">
            {order.attendee_name} · {order.attendee_email}
          </p>
          <Button
            variant="outlined"
            onClick={() => {
              try {
                downloadCalendar(event);
              } catch (error) {
                setActionError(error);
              }
            }}
          >
            {t("OrderConfirmation.addToCalendar")}
          </Button>
        </Card>
        <Card className="space-y-md">
          <h2 className="text-title">{t("OrderConfirmation.orderSummary")}</h2>
          {order.items?.map((item) => (
            <div
              key={item.id}
              className="flex justify-between gap-md text-label"
            >
              <span>
                {t("OrderConfirmation.lineItem", {
                  quantity: item.quantity,
                  name:
                    event.available_ticket_types.find(
                      (type) => type.id === item.ticket_type_id,
                    )?.name ?? t("OrderConfirmation.ticketFallback"),
                })}
              </span>
              <span>{money(item.unit_price_minor * item.quantity)}</span>
            </div>
          ))}
          {!order.items && (
            <p className="text-label text-text-secondary">
              {t("OrderConfirmation.itemizedUnavailable")}
            </p>
          )}
          <dl className="space-y-sm border-t border-divider pt-md text-label">
            <div className="flex justify-between">
              <dt>{t("OrderConfirmation.subtotal")}</dt>
              <dd>{money(order.subtotal_minor)}</dd>
            </div>
            {order.discount_minor > 0 && (
              <div className="flex justify-between">
                <dt>
                  {order.promo_code
                    ? t("OrderConfirmation.discountWithCode", {
                        code: order.promo_code,
                      })
                    : t("OrderConfirmation.discount")}
                </dt>
                <dd>−{money(order.discount_minor)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>{t("OrderConfirmation.processingFee")}</dt>
              <dd>{money(order.processing_fee_minor)}</dd>
            </div>
            <div className="flex justify-between border-t border-divider pt-md text-lg font-semibold">
              <dt>{t("OrderConfirmation.total")}</dt>
              <dd>{money(order.total_minor)}</dd>
            </div>
          </dl>
          {order.total_minor > 0 && (
            <p className="text-label text-text-secondary">
              {t("OrderConfirmation.demoPayment")}
            </p>
          )}
        </Card>
      </div>
      {confirmed && (
        <Card className="flex flex-wrap items-center justify-between gap-md">
          <p role="status" className="text-label">
            {resent ??
              t.rich("OrderConfirmation.emailed", {
                email: order.attendee_email,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
          </p>
          <Button variant="outlined" loading={resending} onClick={resend}>
            {t("OrderConfirmation.resend")}
          </Button>
        </Card>
      )}
      <Card className="flex flex-wrap items-center justify-between gap-md">
        <p className="text-label">
          {t.rich("OrderConfirmation.supportNote", {
            link: (chunks) => (
              <Link href="/support" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
        <RequestSupport
          eventId={event.id}
          eventTitle={event.title}
          orderId={order.id}
          label={t("OrderConfirmation.requestSupport")}
        />
      </Card>
      {!!actionError && <ErrorState error={actionError} />}
      <section className="space-y-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-title">
            {t("OrderConfirmation.digitalTickets")}
          </h2>
          <Button variant="text" onClick={retry}>
            {t("OrderConfirmation.refresh")}
          </Button>
        </div>
        {!!ticketError && <ErrorState error={ticketError} retry={retry} />}
        {tickets.map((ticket) => (
          <Card
            key={ticket.id}
            className="grid items-center gap-lg sm:grid-cols-[240px_1fr]"
          >
            {["valid", "checked_in"].includes(ticket.status) ? (
              <TicketQr id={ticket.id} />
            ) : (
              <div className="rounded-input bg-background p-lg text-center text-text-secondary">
                {t("OrderConfirmation.notValid")}
              </div>
            )}
            <div className="space-y-md">
              <Badge
                variant={
                  ticket.status === "valid"
                    ? "success"
                    : ticket.status === "checked_in"
                      ? "neutral"
                      : "error"
                }
              >
                {ticketStatus(ticket.status)}
              </Badge>
              <h3 className="text-title">
                {event.available_ticket_types.find(
                  (type) => type.id === ticket.ticket_type_id,
                )?.name ?? t("OrderConfirmation.admissionFallback")}
              </h3>
              <p>{ticket.attendee_name}</p>
              {ticket.seat && (
                <p className="text-label">
                  {t("OrderConfirmation.seat", {
                    seat: [ticket.section, ticket.row, ticket.seat]
                      .filter(Boolean)
                      .join(" / "),
                  })}
                </p>
              )}
              <p className="break-all text-label text-text-secondary">
                {t("OrderConfirmation.ticketId", { id: ticket.id })}
              </p>
              <Button
                variant="outlined"
                loading={printing === ticket.id}
                disabled={printing !== null}
                onClick={() => openPrint(ticket)}
              >
                {t("OrderConfirmation.print")}
              </Button>
              <RequestSupport
                eventId={event.id}
                eventTitle={event.title}
                orderId={order.id}
                ticketId={ticket.id}
                label={t("OrderConfirmation.reportProblem")}
                variant="text"
              />
            </div>
          </Card>
        ))}
        {!ticketError && tickets.length === 0 && (
          <p className="text-text-secondary">
            {confirmed
              ? t("OrderConfirmation.noIssued")
              : t("OrderConfirmation.noAdmission")}
          </p>
        )}
      </section>
      <Link href="/events" className="inline-block font-medium underline">
        {t("OrderConfirmation.explore")}
      </Link>
    </main>
  );
}
