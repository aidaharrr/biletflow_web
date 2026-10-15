"use client";
import Link from "next/link";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  createSupportCase,
  listOrganizerEvents,
  listSupportCases,
  listSupportMessages,
  sendSupportMessage,
  updateSupportStatus,
} from "@/lib/api";
import { dateLabel } from "@/lib/organizer";
import { usePollingData } from "@/hooks/usePollingData";
import type {
  Event,
  SupportCase,
  SupportCategory,
  SupportStatus,
} from "@/types/api";
const statuses: { value: SupportStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_for_customer", label: "Waiting for Customer" },
  { value: "resolved", label: "Resolved" },
];
const categories: SupportCategory[] = [
  "ticket_delivery",
  "payment",
  "refund",
  "seating",
  "event_information",
  "check_in",
  "account",
  "technical",
];
const statusLabel = (value: SupportStatus) =>
  statuses.find((status) => status.value === value)?.label ?? value;
export function SupportInbox({
  eventId = "",
  orderId,
  ticketId,
}: {
  eventId?: string;
  orderId?: string;
  ticketId?: string;
}) {
  const load = useCallback(async (signal: AbortSignal) => {
    const [cases, events] = await Promise.all([
      listSupportCases({ signal }),
      listOrganizerEvents({ signal }),
    ]);
    return { cases, events };
  }, []);
  const resource = usePollingData(load, 30000);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [eventFilter, setEventFilter] = useState(eventId);
  const [creating, setCreating] = useState(false);
  if (resource.loading)
    return <LoadingSpinner label="Loading support inbox…" />;
  if (!resource.data)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  const { cases, events } = resource.data;
  const filtered = cases.filter(
    (item) =>
      (!status || item.status === status) &&
      (!eventFilter || item.event_id === eventFilter) &&
      [item.subject, item.category, item.id].some((value) =>
        value.toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  const active = filtered.find((item) => item.id === selected) ?? filtered[0];
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-lg">
        <div className="space-y-sm">
          <p className="text-label uppercase tracking-widest text-primary">
            Keep the conversation connected
          </p>
          <h1 className="font-brand text-3xl font-semibold">Support inbox</h1>
          <p className="text-label text-text-secondary">
            Contextual conversations · Threads refresh automatically
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          Contact platform support
        </Button>
      </header>
      {!!resource.error && (
        <ErrorState error={resource.error} retry={resource.retry} />
      )}
      <div className="grid gap-md sm:grid-cols-3">
        <Input
          label="Search support cases"
          placeholder="Subject, category, or case ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          label="Case status filter"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </Select>
        <Select
          label="Case event filter"
          value={eventFilter}
          onChange={(event) => setEventFilter(event.target.value)}
        >
          <option value="">All events / account support</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid items-start gap-lg xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="space-y-md">
          <div className="flex items-center justify-between gap-sm">
            <h2 className="text-title">Cases ({filtered.length})</h2>
            <Button
              variant="text"
              className="px-sm text-label"
              loading={resource.refreshing}
              onClick={resource.retry}
            >
              Refresh inbox
            </Button>
          </div>
          <div className="max-h-[650px] space-y-sm overflow-y-auto">
            {filtered.map((item) => (
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
                  {events.find((event) => event.id === item.event_id)?.title ??
                    "Account / platform support"}
                </span>
                <span className="mt-sm block">
                  <Badge
                    variant={item.status === "resolved" ? "success" : "neutral"}
                  >
                    {statusLabel(item.status)}
                  </Badge>
                </span>
                <span className="mt-sm block text-label text-text-secondary">
                  {dateLabel(item.updated_at)}
                </span>
              </button>
            ))}
            {!filtered.length && (
              <p className="py-lg text-label text-text-secondary">
                No support cases match these filters.
              </p>
            )}
          </div>
        </Card>
        {active ? (
          <SupportThread
            key={active.id}
            supportCase={active}
            event={events.find((event) => event.id === active.event_id)}
            onUpdated={resource.retry}
          />
        ) : (
          <Card>
            <p className="text-label text-text-secondary">
              Select a case to view its conversation or open a platform-support
              request.
            </p>
          </Card>
        )}
      </div>
      {creating && (
        <NewCase
          events={events}
          eventId={
            events.some((event) => event.id === eventFilter) ? eventFilter : ""
          }
          orderId={orderId}
          ticketId={ticketId}
          onClose={() => setCreating(false)}
          onCreated={(item) => {
            setCreating(false);
            setSelected(item.id);
            setEventFilter("");
            setStatus("");
            setSearch("");
            resource.retry();
          }}
        />
      )}
    </>
  );
}
function SupportThread({
  supportCase,
  event,
  onUpdated,
}: {
  supportCase: SupportCase;
  event?: Event;
  onUpdated: () => void;
}) {
  const { user } = useAuth();
  const load = useCallback(
    (signal: AbortSignal) => listSupportMessages(supportCase.id, { signal }),
    [supportCase.id],
  );
  const resource = usePollingData(load);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [nextStatus, setNextStatus] = useState<SupportStatus>(
    supportCase.status,
  );
  const key = useRef<{ body: string; key: string } | null>(null);
  async function reply(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    const message = body.trim();
    if (!message) {
      setError(new Error("Write a message before sending."));
      return;
    }
    if (key.current?.body !== message)
      key.current = { body: message, key: crypto.randomUUID() };
    setBusy(true);
    setError(null);
    try {
      await sendSupportMessage(supportCase.id, message, key.current.key);
      setBody("");
      key.current = null;
      resource.retry();
      onUpdated();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  const mayUpdate = user?.id !== supportCase.requester_id;
  return (
    <Card className="min-w-0 space-y-lg">
      <header className="space-y-md">
        <div className="flex flex-wrap items-start justify-between gap-md">
          <h2 className="break-words text-title">{supportCase.subject}</h2>
          <Badge
            variant={supportCase.status === "resolved" ? "success" : "neutral"}
          >
            {statusLabel(supportCase.status)}
          </Badge>
        </div>
        <p className="break-all text-label text-text-secondary">
          Case {supportCase.id} · {supportCase.category.replace(/_/g, " ")}
        </p>
        <div className="flex flex-wrap gap-md text-label">
          {event && (
            <Link href={`/organizer/events/${event.id}`} className="underline">
              Event: {event.title}
            </Link>
          )}
          {supportCase.order_id && (
            <Link
              href={`/orders/${supportCase.order_id}`}
              className="underline"
            >
              View contextual order
            </Link>
          )}
          {supportCase.ticket_id && (
            <span className="break-all text-text-secondary">
              Ticket: {supportCase.ticket_id}
            </span>
          )}
        </div>
      </header>
      {resource.loading ? (
        <LoadingSpinner label="Loading message thread…" />
      ) : (
        <>
          <div
            aria-label="Support messages"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            className="max-h-[500px] space-y-md overflow-y-auto rounded-input bg-background p-md"
          >
            {[...(resource.data ?? [])]
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .map((message) => (
                <article
                  key={message.id}
                  className={`max-w-[90%] rounded-card border border-divider p-md ${message.sender_id === user?.id ? "ml-auto bg-primary/5" : "bg-surface"}`}
                >
                  <p className="mb-sm text-label font-medium">
                    {message.sender_id === user?.id
                      ? "You"
                      : message.sender_id === supportCase.requester_id
                        ? "Requester"
                        : "Support staff"}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-label">
                    {message.body}
                  </p>
                  <time
                    dateTime={message.created_at}
                    className="mt-sm block text-label text-text-secondary"
                  >
                    {dateLabel(message.created_at)}
                  </time>
                </article>
              ))}
            {resource.data?.length === 0 && (
              <p className="text-label text-text-secondary">No messages yet.</p>
            )}
          </div>
          {!!resource.error && (
            <ErrorState error={resource.error} retry={resource.retry} />
          )}
        </>
      )}
      {!!error && <ErrorState error={error} />}
      <form onSubmit={reply} className="space-y-md">
        <Textarea
          label="Reply to support case"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          maxLength={10000}
          disabled={busy}
        />
        <Button type="submit" loading={busy} disabled={!body.trim()}>
          Send reply
        </Button>
      </form>
      {mayUpdate ? (
        <div className="grid items-end gap-md sm:grid-cols-[1fr_auto]">
          <Select
            label="Update case status"
            value={nextStatus}
            onChange={(event) =>
              setNextStatus(event.target.value as SupportStatus)
            }
            disabled={busy}
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </Select>
          <Button
            variant="outlined"
            disabled={busy || nextStatus === supportCase.status}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await updateSupportStatus(supportCase.id, nextStatus);
                onUpdated();
              } catch (error) {
                setError(error);
              } finally {
                setBusy(false);
              }
            }}
          >
            Update status
          </Button>
        </div>
      ) : (
        <p className="text-label text-text-secondary">
          Platform staff manage the status of your own support requests.
        </p>
      )}
    </Card>
  );
}
function NewCase({
  events,
  eventId,
  orderId,
  ticketId,
  onClose,
  onCreated,
}: {
  events: Event[];
  eventId: string;
  orderId?: string;
  ticketId?: string;
  onClose: () => void;
  onCreated: (item: SupportCase) => void;
}) {
  const [selectedEvent, setSelectedEvent] = useState(eventId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const request = useRef<{ signature: string; key: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const message = String(form.get("message")).trim();
      if (!message) throw new Error("Please describe the issue.");
      const body = {
        subject: String(form.get("subject")).trim(),
        category: String(form.get("category")) as SupportCategory,
        message,
        ...(selectedEvent ? { event_id: selectedEvent } : {}),
        ...(selectedEvent === eventId && orderId ? { order_id: orderId } : {}),
        ...(selectedEvent === eventId && ticketId
          ? { ticket_id: ticketId }
          : {}),
      };
      const signature = JSON.stringify(body);
      if (request.current?.signature !== signature)
        request.current = { signature, key: crypto.randomUUID() };
      onCreated(await createSupportCase(body, request.current.key));
    } catch (error) {
      setError(error);
      setBusy(false);
    }
  }
  return (
    <Modal title="Contact platform support" busy={busy} onClose={onClose}>
      {!!error && <ErrorState error={error} />}
      <form onSubmit={submit} className="space-y-md">
        <Input
          label="Support subject"
          name="subject"
          minLength={3}
          maxLength={200}
          required
          disabled={busy}
        />
        <Select
          label="Issue category"
          name="category"
          defaultValue="technical"
          disabled={busy}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <Select
          label="Event context (optional)"
          value={selectedEvent}
          onChange={(event) => setSelectedEvent(event.target.value)}
          disabled={busy}
        >
          <option value="">Account / platform issue</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </Select>
        {selectedEvent === eventId && (orderId || ticketId) && (
          <p className="break-all text-label text-text-secondary">
            {orderId && `Order: ${orderId}. `}
            {ticketId && `Ticket: ${ticketId}.`}
          </p>
        )}
        <Textarea
          label="Describe your issue"
          name="message"
          required
          maxLength={10000}
          disabled={busy}
        />
        <Button type="submit" loading={busy} className="w-full">
          Open support case
        </Button>
      </form>
    </Modal>
  );
}
