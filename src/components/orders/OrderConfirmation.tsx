"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
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

export function OrderConfirmation({ id }: { id: string }) {
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
            throw new Error(
              "This order's ticket details are unavailable. Please contact the organizer.",
            );
          tickets = owned.filter((ticket) => ticket.order_id === order.id);
        } catch (error) {
          ticketError = error;
        }
      }
      return { order, event, tickets: tickets ?? [], ticketError };
    },
    [id],
  );
  const { data, loading, error, retry } = useApiData(load);
  const [actionError, setActionError] = useState<unknown>(null);
  const [printing, setPrinting] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState<string | null>(null);
  if (loading) return <LoadingSpinner label="Loading your booking…" />;
  if (error || !data)
    return (
      <main className="mx-auto max-w-4xl px-md py-xl">
        <ErrorState
          error={error ?? new Error("Order unavailable.")}
          retry={retry}
        />
        {error instanceof ApiError && error.status === 401 && (
          <Link
            className="mt-lg inline-block underline"
            href={`/login?next=${encodeURIComponent(`/orders/${id}`)}`}
          >
            Sign in to view this order
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
      setResent(result?.message ?? `Tickets sent to ${order.attendee_email}.`);
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
          {order.status.replace(/_/g, " ")}
        </Badge>
        <h1 className="font-brand text-3xl font-semibold">
          {confirmed ? "You’re going!" : "Your booking"}
        </h1>
        <p className="text-text-secondary">{event.title}</p>
        <p className="text-label text-text-secondary">Order {order.id}</p>
      </header>
      {!confirmed && (
        <Card>
          <p>
            {order.status === "pending"
              ? "This order has not been completed. Tickets are issued after checkout is confirmed."
              : "Check each ticket’s current status before attending."}
          </p>
        </Card>
      )}
      <div className="grid items-start gap-lg md:grid-cols-2">
        <Card className="space-y-md">
          <h2 className="text-title">Your event</h2>
          <p>{event.title}</p>
          <p className="text-label text-text-secondary">
            {eventDate(event)} · {event.time_zone}
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
            Add to Calendar
          </Button>
        </Card>
        <Card className="space-y-md">
          <h2 className="text-title">Order summary</h2>
          {order.items?.map((item) => (
            <div
              key={item.id}
              className="flex justify-between gap-md text-label"
            >
              <span>
                {item.quantity} ×{" "}
                {event.available_ticket_types.find(
                  (type) => type.id === item.ticket_type_id,
                )?.name ?? "Ticket"}
              </span>
              <span>{formatKZT(item.unit_price_minor * item.quantity)}</span>
            </div>
          ))}
          {!order.items && (
            <p className="text-label text-text-secondary">
              Itemized details are unavailable for this order.
            </p>
          )}
          <dl className="space-y-sm border-t border-divider pt-md text-label">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatKZT(order.subtotal_minor)}</dd>
            </div>
            {order.discount_minor > 0 && (
              <div className="flex justify-between">
                <dt>
                  Discount
                  {order.promo_code ? ` (code ${order.promo_code})` : ""}
                </dt>
                <dd>−{formatKZT(order.discount_minor)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Processing fee</dt>
              <dd>{formatKZT(order.processing_fee_minor)}</dd>
            </div>
            <div className="flex justify-between border-t border-divider pt-md text-lg font-semibold">
              <dt>Total</dt>
              <dd>{formatKZT(order.total_minor)}</dd>
            </div>
          </dl>
          {order.total_minor > 0 && (
            <p className="text-label text-text-secondary">
              Demo payment · No real money charged.
            </p>
          )}
        </Card>
      </div>
      {confirmed && (
        <Card className="flex flex-wrap items-center justify-between gap-md">
          <p role="status" className="text-label">
            {resent ?? (
              <>
                Your tickets and printable PDFs were emailed to{" "}
                <strong>{order.attendee_email}</strong>.
              </>
            )}
          </p>
          <Button variant="outlined" loading={resending} onClick={resend}>
            Resend tickets by email
          </Button>
        </Card>
      )}
      {!!actionError && <ErrorState error={actionError} />}
      <section className="space-y-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-title">Your digital tickets</h2>
          <Button variant="text" onClick={retry}>
            Refresh ticket status
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
                Not valid for admission
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
                {ticket.status.replace(/_/g, " ")}
              </Badge>
              <h3 className="text-title">
                {event.available_ticket_types.find(
                  (type) => type.id === ticket.ticket_type_id,
                )?.name ?? "Admission ticket"}
              </h3>
              <p>{ticket.attendee_name}</p>
              {ticket.seat && (
                <p className="text-label">
                  Seat:{" "}
                  {[ticket.section, ticket.row, ticket.seat]
                    .filter(Boolean)
                    .join(" / ")}
                </p>
              )}
              <p className="break-all text-label text-text-secondary">
                Ticket ID: {ticket.id}
              </p>
              <Button
                variant="outlined"
                loading={printing === ticket.id}
                disabled={printing !== null}
                onClick={() => openPrint(ticket)}
              >
                Download / Print PDF Ticket
              </Button>
            </div>
          </Card>
        ))}
        {!ticketError && tickets.length === 0 && (
          <p className="text-text-secondary">
            {confirmed
              ? "No issued tickets were returned for this order. Refresh or contact the organizer."
              : "No admission tickets to display."}
          </p>
        )}
      </section>
      <Link href="/events" className="inline-block font-medium underline">
        Explore more events
      </Link>
    </main>
  );
}
