"use client";
import Link from "next/link";
import { useCallback, useRef, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Select,
  StatCard,
  Textarea,
} from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EventActions } from "./EventActions";
import { PaidActivation } from "./PaidActivation";
import {
  ApiError,
  getManagedEvent,
  getOrganizerSummary,
  getSalesSeries,
  getTicketTypeAnalytics,
  listEventHistory,
  listEventOrders,
  publishEvent,
  refundOrder,
  unpublishEvent,
} from "@/lib/api";
import { dateLabel, filterSales, percentText } from "@/lib/organizer";
import { eventDate } from "@/lib/events";
import { formatKZT } from "@/lib/money";
import { useApiData } from "@/hooks/useApiData";
import type { Order } from "@/types/api";
async function capture<T>(
  promise: Promise<T>,
): Promise<{ data: T | null; error: unknown }> {
  try {
    return { data: await promise, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.max(0, Math.min(100, value))}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 overflow-hidden rounded-full bg-divider"
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
export function EventAnalytics({ id }: { id: string }) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const event = await getManagedEvent(id, { signal });
      const [summary, series, types, history, orders] = await Promise.all([
        capture(getOrganizerSummary(id, { signal })),
        capture(getSalesSeries(id, { signal })),
        capture(getTicketTypeAnalytics(id, { signal })),
        capture(listEventHistory(id, { signal })),
        capture(listEventOrders(id, { signal })),
      ]);
      return {
        event,
        summary,
        series,
        types,
        history,
        orders,
        asOf: Date.now(),
      };
    },
    [id],
  );
  const resource = useApiData(load);
  const [search, setSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [refund, setRefund] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const refundKey = useRef<{ signature: string; key: string } | null>(null);
  async function confirmRefund(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    if (!refund) return;
    const reason = String(
      new FormData(submit.currentTarget).get("reason"),
    ).trim();
    if (reason.length < 3) {
      setError(new Error("Enter a refund reason."));
      return;
    }
    setBusy(true);
    setError(null);
    const signature = `${refund.id}:${reason}`;
    if (refundKey.current?.signature !== signature)
      refundKey.current = { signature, key: crypto.randomUUID() };
    try {
      const result = await refundOrder(
        refund.id,
        reason,
        refundKey.current.key,
      );
      setNotice(
        result.status === "succeeded"
          ? "Demonstration refund completed. The server invalidated this order’s tickets."
          : `Refund request submitted: ${result.status}.`,
      );
      setRefund(null);
      refundKey.current = null;
      resource.retry();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  async function lifecycle(action: "publish" | "unpublish") {
    setBusy(true);
    setError(null);
    try {
      if (action === "publish") await publishEvent(id);
      else await unpublishEvent(id);
      setNotice(
        action === "publish" ? "Event published." : "Event returned to draft.",
      );
      resource.retry();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  if (resource.loading)
    return <LoadingSpinner label="Loading event analytics and history…" />;
  if (resource.error || !resource.data)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  const { event, summary, series, types, history, orders } = resource.data;
  const metrics = summary.data;
  const ticketTypes = event.available_ticket_types.filter(
    (type) => !selectedType || type.id === selectedType,
  );
  const points = filterSales(series.data ?? [], from, to);
  const maxRevenue = Math.max(1, ...points.map((point) => point.revenue_minor));
  const historyRows = [...(history.data ?? [])]
    .filter((entry) => !actionFilter || entry.action === actionFilter)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const attendees = (orders.data ?? []).filter(
    (order) =>
      (!orderStatus || order.status === orderStatus) &&
      [order.attendee_name, order.attendee_email, order.id].some((value) =>
        value.toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  const unavailableTypeRevenue =
    types.error instanceof ApiError && [404, 405].includes(types.error.status);
  const hasPaid = event.available_ticket_types.some(
    (type) => type.kind === "paid",
  );
  return (
    <>
      <header className="space-y-md">
        <Link
          href="/organizer/dashboard"
          className="text-label text-text-secondary underline"
        >
          ← Dashboard
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-md">
          <div className="min-w-0 space-y-sm">
            <Badge
              variant={
                event.status === "cancelled"
                  ? "error"
                  : event.status === "published"
                    ? "success"
                    : "neutral"
              }
            >
              {event.status}
            </Badge>
            <h1 className="break-words font-brand text-3xl font-semibold">
              {event.title}
            </h1>
            <p className="text-label text-text-secondary">
              {eventDate(event)} · {event.venue.name}
            </p>
          </div>
          <Button variant="outlined" onClick={resource.retry}>
            Refresh event data
          </Button>
        </div>
        <EventActions event={event} onChanged={resource.retry} />
        <div className="flex flex-wrap gap-md text-label">
          <Link href={`/organizer/campaigns?event=${id}`} className="underline">
            Campaigns for this event
          </Link>
          <Link href={`/organizer/support?event=${id}`} className="underline">
            Event support cases
          </Link>
          {event.status !== "draft" && event.visibility !== "private" && (
            <Link href={`/events/${id}`} className="underline">
              Public event page ↗
            </Link>
          )}
          {event.status === "draft" && (
            <Link
              href={`/organizer/events/create?draft=${id}`}
              className="underline"
            >
              Complete or edit this draft
            </Link>
          )}
        </div>
      </header>
      {notice && (
        <p
          role="status"
          className="rounded-input border border-success/30 bg-success/5 p-md text-label"
        >
          {notice}
        </p>
      )}
      {!!error && !refund && <ErrorState error={error} />}
      <p className="text-label text-text-secondary">
        All-time event totals · Sandbox financial records · Server-calculated
        metrics
      </p>
      <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Gross sales"
          value={metrics ? formatKZT(metrics.gross_sales_minor) : "—"}
          helper="Confirmed order subtotals"
          accent
        />
        <StatCard
          label="Tickets sold"
          value={
            metrics ? `${metrics.tickets_sold} / ${metrics.capacity}` : "—"
          }
          helper={
            metrics
              ? `${percentText(metrics.percentage_sold)} of ticket capacity`
              : "Unavailable"
          }
        />
        <StatCard
          label="Check-in percentage"
          value={metrics ? percentText(metrics.check_in_percentage) : "—"}
          helper={
            metrics
              ? `${metrics.checked_in} checked in · ${metrics.absent} absent`
              : "Unavailable"
          }
        />
        <StatCard
          label="Net demonstration revenue"
          value={metrics ? formatKZT(metrics.net_revenue_minor) : "—"}
          helper="Server net after recorded refunds"
        />
      </div>
      {!!summary.error && (
        <ErrorState error={summary.error} retry={resource.retry} />
      )}
      <div className="grid gap-lg lg:grid-cols-2">
        <Card className="space-y-md">
          <h2 className="text-title">Sales progress</h2>
          {metrics ? (
            <>
              <Progress
                value={metrics.percentage_sold}
                label="Ticket sales progress"
              />
              <p className="text-label text-text-secondary">
                {metrics.tickets_sold} sold · {metrics.tickets_remaining}{" "}
                remaining
              </p>
              <dl className="space-y-sm text-label">
                <div className="flex justify-between gap-md">
                  <dt>Discounts</dt>
                  <dd>{formatKZT(metrics.discounts_minor)}</dd>
                </div>
                <div className="flex justify-between gap-md">
                  <dt>Refunds</dt>
                  <dd>{formatKZT(metrics.refunds_minor)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-label text-text-secondary">
              Sales metrics are unavailable.
            </p>
          )}
        </Card>
        <Card className="space-y-md">
          <h2 className="text-title">Attendance</h2>
          {metrics ? (
            <>
              <Progress
                value={metrics.check_in_percentage}
                label="Check-in attendance"
              />
              <p className="text-label text-text-secondary">
                {metrics.checked_in} checked in out of {metrics.tickets_sold}{" "}
                valid issued tickets.
              </p>
            </>
          ) : (
            <p className="text-label text-text-secondary">
              Attendance metrics are unavailable.
            </p>
          )}
        </Card>
      </div>
      <Card className="space-y-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-title">Sales over time</h2>
          <div className="flex flex-wrap gap-md">
            <Input
              label="Sales date from (UTC)"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <Input
              label="Sales date to (UTC)"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        </div>
        {from && to && from > to ? (
          <p role="alert" className="text-label text-error">
            The end date must not precede the start date.
          </p>
        ) : series.error ? (
          <ErrorState error={series.error} retry={resource.retry} />
        ) : points.length ? (
          <div
            aria-label="Daily confirmed order revenue"
            className="max-h-80 space-y-md overflow-y-auto"
          >
            {points.map((point) => (
              <div key={point.date} className="space-y-sm">
                <div className="flex flex-wrap justify-between gap-sm text-label">
                  <span>
                    {point.date} · {point.orders} orders
                  </span>
                  <span className="font-medium">
                    {formatKZT(point.revenue_minor)}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${(Math.max(0, point.revenue_minor) * 100) / maxRevenue}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-label text-text-secondary">
            No confirmed sales in this date range.
          </p>
        )}
        <p className="text-label text-text-secondary">
          The date range filters this series only. Confirmed order totals
          include processing fees. Event summary cards remain all-time.
        </p>
      </Card>
      <section className="space-y-lg">
        <div className="grid items-end gap-md sm:grid-cols-[1fr_260px]">
          <h2 className="text-title">Ticket type revenue breakdown</h2>
          <Select
            label="Compare ticket type"
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value)}
          >
            <option value="">All ticket types</option>
            {event.available_ticket_types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </div>
        {unavailableTypeRevenue && (
          <p
            role="status"
            className="rounded-input border border-divider bg-surface p-md text-label text-text-secondary"
          >
            Ticket-type revenue reporting is not available yet. Inventory counts
            are shown below; historical revenue is not estimated from current
            ticket prices.
          </p>
        )}
        {!!types.error && !unavailableTypeRevenue && (
          <ErrorState error={types.error} retry={resource.retry} />
        )}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[660px] text-left text-label">
              <thead className="border-b border-divider bg-background text-text-secondary">
                <tr>
                  {[
                    "Ticket type",
                    "Available",
                    "Reserved",
                    "Sold",
                    "Refunded",
                    "Gross revenue",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-lg py-md font-medium"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ticketTypes.map((type) => {
                  const revenue = types.data?.find(
                    (row) => row.ticket_type_id === type.id,
                  );
                  return (
                    <tr
                      key={type.id}
                      className="border-b border-divider last:border-0"
                    >
                      <td className="px-lg py-md">
                        <p className="font-medium">{type.name}</p>
                        <p className="mt-xs text-text-secondary">
                          {type.kind === "free"
                            ? "Free"
                            : formatKZT(type.price_minor)}
                          {type.is_hidden ? " · Hidden" : ""}
                        </p>
                      </td>
                      <td className="px-lg py-md">
                        {Math.max(
                          0,
                          type.quantity - type.sold_count - type.reserved_count,
                        )}
                      </td>
                      <td className="px-lg py-md">{type.reserved_count}</td>
                      <td className="px-lg py-md">{type.sold_count}</td>
                      <td className="px-lg py-md">{type.refunded_count}</td>
                      <td className="px-lg py-md">
                        {revenue ? formatKZT(revenue.gross_sales_minor) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!ticketTypes.length && (
              <p className="p-lg text-label text-text-secondary">
                No ticket types configured.
              </p>
            )}
          </div>
        </Card>
      </section>
      <section id="attendees" className="scroll-mt-lg space-y-lg">
        <h2 className="text-title">Attendee list</h2>
        <p className="text-label text-text-secondary">
          Attendee details from event orders. Each row represents one order,
          which may contain several tickets.
        </p>
        <div className="grid gap-md sm:grid-cols-2">
          <Input
            label="Search attendees"
            placeholder="Name, email, or order ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            label="Attendee order status"
            value={orderStatus}
            onChange={(event) => setOrderStatus(event.target.value)}
          >
            <option value="">All orders</option>
            {[
              "confirmed",
              "pending",
              "refunded",
              "partially_refunded",
              "cancelled",
              "expired",
              "payment_failed",
            ].map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </div>
        {orders.error ? (
          <ErrorState error={orders.error} retry={resource.retry} />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-label">
                <thead className="border-b border-divider bg-background text-text-secondary">
                  <tr>
                    {[
                      "Attendee / Email",
                      "Order",
                      "Status",
                      "Total",
                      "Refund",
                    ].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="px-lg py-md font-medium"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-divider last:border-0"
                    >
                      <td className="px-lg py-md">
                        <p className="font-medium">{order.attendee_name}</p>
                        <p className="mt-xs text-text-secondary">
                          {order.attendee_email}
                        </p>
                      </td>
                      <td className="px-lg py-md">
                        <Link
                          href={`/orders/${order.id}`}
                          className="underline"
                        >
                          {order.id.slice(0, 8)}
                        </Link>
                        {order.items && (
                          <p className="mt-xs text-text-secondary">
                            {order.items.reduce(
                              (sum, item) => sum + item.quantity,
                              0,
                            )}{" "}
                            tickets
                          </p>
                        )}
                      </td>
                      <td className="px-lg py-md">
                        <Badge
                          variant={
                            order.status === "confirmed" ? "success" : "neutral"
                          }
                        >
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-lg py-md">
                        {formatKZT(order.total_minor)}
                      </td>
                      <td className="px-lg py-md">
                        <Button
                          variant="outlined"
                          className="text-label"
                          disabled={order.status !== "confirmed" || busy}
                          onClick={() => {
                            setError(null);
                            setRefund(order);
                          }}
                        >
                          Refund order {order.id.slice(0, 8)}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!attendees.length && (
                <p className="p-lg text-label text-text-secondary">
                  No attendees match this search.
                </p>
              )}
            </div>
          </Card>
        )}
      </section>
      <section className="space-y-lg">
        <div className="grid items-end gap-md sm:grid-cols-[1fr_260px]">
          <h2 className="text-title">Activity timeline</h2>
          <Select
            label="Timeline action"
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
          >
            <option value="">All actions</option>
            {[...new Set((history.data ?? []).map((entry) => entry.action))]
              .sort()
              .map((action) => (
                <option key={action} value={action}>
                  {action.replace(/[._]/g, " ")}
                </option>
              ))}
          </Select>
        </div>
        {history.error ? (
          <ErrorState error={history.error} retry={resource.retry} />
        ) : (
          <Card>
            <ol className="max-h-[600px] space-y-lg overflow-y-auto">
              {historyRows.map((entry) => (
                <li
                  key={entry.id}
                  className="relative ml-sm border-l-2 border-divider pl-lg"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -left-[6px] top-1 size-2.5 rounded-full bg-primary"
                  />
                  <p className="text-label font-medium">{entry.description}</p>
                  <p className="mt-xs break-all text-label text-text-secondary">
                    {entry.action.replace(/[._]/g, " ")} ·{" "}
                    {entry.actor_name ??
                      (entry.actor_id
                        ? `Actor ${entry.actor_id.slice(0, 8)}`
                        : "System")}
                  </p>
                  <time
                    dateTime={entry.timestamp}
                    className="mt-sm block text-label text-text-secondary"
                  >
                    {dateLabel(entry.timestamp)} · UTC+05:00
                  </time>
                </li>
              ))}
            </ol>
            {!historyRows.length && (
              <p className="text-label text-text-secondary">
                No recorded activity for this filter.
              </p>
            )}
            <p className="mt-lg text-label text-text-secondary">
              Oldest to newest · Server-recorded activity
            </p>
          </Card>
        )}
      </section>
      {["draft", "published"].includes(event.status) &&
        Date.parse(event.ends_at) > resource.data.asOf && (
          <Card className="space-y-lg">
            <h2 className="text-title">Publication & paid sales</h2>
            {hasPaid && (
              <PaidActivation eventId={id} onActivated={resource.retry} />
            )}
            <div className="flex flex-wrap gap-md">
              {event.status === "draft" ? (
                <Button
                  loading={busy}
                  disabled={
                    !event.available_ticket_types.length ||
                    (hasPaid && event.paid_sales_status !== "active")
                  }
                  onClick={() => lifecycle("publish")}
                >
                  Publish event
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  loading={busy}
                  onClick={() => lifecycle("unpublish")}
                >
                  Unpublish event
                </Button>
              )}
              <p className="self-center text-label text-text-secondary">
                {hasPaid && event.paid_sales_status !== "active"
                  ? "Complete paid-sales activation before publishing."
                  : "Changes remain part of this event’s history."}
              </p>
            </div>
          </Card>
        )}
      {refund && (
        <Modal
          title="Refund this order?"
          busy={busy}
          onClose={() => {
            setRefund(null);
            setError(null);
          }}
        >
          <p className="text-label text-text-secondary">
            Full demonstration refund for {refund.attendee_name}:{" "}
            {formatKZT(refund.total_minor)}. Successful refunds invalidate every
            ticket on this order. No real money is transferred.
          </p>
          {!!error && <ErrorState error={error} />}
          <form onSubmit={confirmRefund} className="space-y-lg">
            <Textarea
              label="Refund reason"
              name="reason"
              required
              minLength={3}
              maxLength={500}
              disabled={busy}
            />
            <Button type="submit" className="w-full bg-error" loading={busy}>
              Confirm full refund
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
