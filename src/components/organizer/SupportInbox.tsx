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
  assignSupportCase,
  createSupportCase,
  listCaseAssignees,
  listOrganizerEvents,
  listSupportCases,
  listSupportMessages,
  sendSupportMessage,
  updateSupportStatus,
} from "@/lib/api";
import { dateLabel } from "@/lib/organizer";
import { usePollingData } from "@/hooks/usePollingData";
import { useApiData } from "@/hooks/useApiData";
import type {
  Event,
  SupportCase,
  SupportCategory,
  SupportStatus,
} from "@/types/api";
import { useTranslations } from "next-intl";
import { useIntlLocale } from "@/i18n/labels";
const statuses: { value: SupportStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_for_customer", label: "Waiting for Customer" },
  { value: "resolved", label: "Resolved" },
];
/** Organizer-to-platform requests (backend PLATFORM categories). */
const platformCategories: SupportCategory[] = [
  "account",
  "activation",
  "payment",
  "technical",
];
/** English label (kept for callers outside React); UI code uses useSupportStatusLabel. */
export const statusLabel = (value: SupportStatus) =>
  statuses.find((status) => status.value === value)?.label ?? value;
const statusKeys: Record<SupportStatus, string> = {
  open: "open",
  in_progress: "inProgress",
  waiting_for_customer: "waitingForCustomer",
  resolved: "resolved",
};
/** Translated support case status; unknown API values are shown unchanged. */
export function useSupportStatusLabel() {
  const t = useTranslations("supportInbox.status");
  return (value: SupportStatus) =>
    value in statusKeys ? t(statusKeys[value]) : value;
}
const categoryKeys: Record<SupportCategory, string> = {
  report_event: "reportEvent",
  activation: "activation",
  ticket_delivery: "ticketDelivery",
  payment: "payment",
  refund: "refund",
  seating: "seating",
  event_information: "eventInformation",
  check_in: "checkIn",
  account: "account",
  technical: "technical",
};
/** Translated support category; unknown API values fall back to readable text. */
export function useSupportCategoryLabel() {
  const t = useTranslations("supportInbox.category");
  return (value: SupportCategory) =>
    value in categoryKeys
      ? t(categoryKeys[value])
      : String(value).replace(/_/g, " ");
}
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
  const t = useTranslations("supportInbox");
  const caseStatus = useSupportStatusLabel();
  const locale = useIntlLocale();
  if (resource.loading) return <LoadingSpinner label={t("loading")} />;
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
            {t("header.eyebrow")}
          </p>
          <h1 className="font-brand text-3xl font-semibold">
            {t("header.title")}
          </h1>
          <p className="text-label text-text-secondary">
            {t("header.subtitle")}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          {t("contactPlatform")}
        </Button>
      </header>
      {!!resource.error && (
        <ErrorState error={resource.error} retry={resource.retry} />
      )}
      <div className="grid gap-md sm:grid-cols-3">
        <Input
          label={t("filters.search")}
          placeholder={t("filters.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          label={t("filters.status")}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">{t("filters.allStatuses")}</option>
          {statuses.map((status) => (
            <option key={status.value} value={status.value}>
              {caseStatus(status.value)}
            </option>
          ))}
        </Select>
        <Select
          label={t("filters.event")}
          value={eventFilter}
          onChange={(event) => setEventFilter(event.target.value)}
        >
          <option value="">{t("filters.allEvents")}</option>
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
            <h2 className="text-title">
              {t("list.title", { count: filtered.length })}
            </h2>
            <Button
              variant="text"
              className="px-sm text-label"
              loading={resource.refreshing}
              onClick={resource.retry}
            >
              {t("list.refresh")}
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
                    item.event_title ??
                    t("list.accountSupport")}
                </span>
                <span className="mt-sm flex flex-wrap gap-sm">
                  <Badge
                    variant={item.status === "resolved" ? "success" : "neutral"}
                  >
                    {caseStatus(item.status)}
                  </Badge>
                  {item.flow === "organizer_platform" && (
                    <Badge>{t("list.platformRequest")}</Badge>
                  )}
                </span>
                <span className="mt-sm block text-label text-text-secondary">
                  {item.assignee_name
                    ? t("list.assignedTo", { name: item.assignee_name })
                    : t("list.unassigned")}
                </span>
                <span className="mt-sm block text-label text-text-secondary">
                  {dateLabel(item.updated_at, locale)}
                </span>
              </button>
            ))}
            {!filtered.length && (
              <p className="py-lg text-label text-text-secondary">
                {t("list.empty")}
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
              {t("list.selectPrompt")}
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
export function SupportThread({
  supportCase,
  event,
  onUpdated,
}: {
  supportCase: SupportCase;
  event?: Event;
  onUpdated: () => void;
}) {
  const { user } = useAuth();
  const t = useTranslations("supportInbox.thread");
  const caseStatus = useSupportStatusLabel();
  const categoryLabel = useSupportCategoryLabel();
  const locale = useIntlLocale();
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
      setError(new Error(t("emptyMessage")));
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
  const mayUpdate =
    supportCase.can_manage ?? user?.id !== supportCase.requester_id;
  return (
    <Card className="min-w-0 space-y-lg">
      <header className="space-y-md">
        <div className="flex flex-wrap items-start justify-between gap-md">
          <h2 className="break-words text-title">{supportCase.subject}</h2>
          <Badge
            variant={supportCase.status === "resolved" ? "success" : "neutral"}
          >
            {caseStatus(supportCase.status)}
          </Badge>
        </div>
        <p className="break-all text-label text-text-secondary">
          {t("meta", {
            number: String(supportCase.number ?? supportCase.id),
            category: categoryLabel(supportCase.category),
          })}{" "}
          ·{" "}
          {supportCase.assignee_name
            ? t("assignedTo", { name: supportCase.assignee_name })
            : t("unassigned")}
        </p>
        <div className="flex flex-wrap gap-md text-label">
          {event ? (
            <Link href={`/organizer/events/${event.id}`} className="underline">
              {t("eventLink", { title: event.title })}
            </Link>
          ) : (
            supportCase.event_id &&
            supportCase.event_title && (
              <Link
                href={`/events/${supportCase.event_id}`}
                className="underline"
              >
                {t("eventLink", { title: supportCase.event_title })}
              </Link>
            )
          )}
          {supportCase.order_id && (
            <Link
              href={`/orders/${supportCase.order_id}`}
              className="underline"
            >
              {t("viewOrder")}
            </Link>
          )}
          {supportCase.ticket_id && (
            <span className="break-all text-text-secondary">
              {t("ticket", { id: supportCase.ticket_id })}
            </span>
          )}
        </div>
      </header>
      {resource.loading ? (
        <LoadingSpinner label={t("loading")} />
      ) : (
        <>
          <div
            aria-label={t("messagesLabel")}
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
                      ? t("sender.you")
                      : message.sender_id === supportCase.requester_id
                        ? t("sender.requester")
                        : t("sender.staff")}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-label">
                    {message.body}
                  </p>
                  <time
                    dateTime={message.created_at}
                    className="mt-sm block text-label text-text-secondary"
                  >
                    {dateLabel(message.created_at, locale)}
                  </time>
                </article>
              ))}
            {resource.data?.length === 0 && (
              <p className="text-label text-text-secondary">
                {t("noMessages")}
              </p>
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
          label={t("replyLabel")}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          maxLength={10000}
          disabled={busy}
        />
        <Button type="submit" loading={busy} disabled={!body.trim()}>
          {t("send")}
        </Button>
      </form>
      {mayUpdate && (
        <CaseAssignment supportCase={supportCase} onUpdated={onUpdated} />
      )}
      {mayUpdate ? (
        <div className="grid items-end gap-md sm:grid-cols-[1fr_auto]">
          <Select
            label={t("statusLabel")}
            value={nextStatus}
            onChange={(event) =>
              setNextStatus(event.target.value as SupportStatus)
            }
            disabled={busy}
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {caseStatus(status.value)}
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
            {t("updateStatus")}
          </Button>
        </div>
      ) : (
        <p className="text-label text-text-secondary">{t("requesterNote")}</p>
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
  const t = useTranslations("supportInbox.newCase");
  const categoryLabel = useSupportCategoryLabel();
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
      if (!message) throw new Error(t("describeRequired"));
      const body = {
        flow: "organizer_platform" as const,
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
    <Modal title={t("title")} busy={busy} onClose={onClose}>
      {!!error && <ErrorState error={error} />}
      <form onSubmit={submit} className="space-y-md">
        <Input
          label={t("subject")}
          name="subject"
          minLength={3}
          maxLength={200}
          required
          disabled={busy}
        />
        <Select
          label={t("category")}
          name="category"
          defaultValue="technical"
          disabled={busy}
        >
          {platformCategories.map((category) => (
            <option key={category} value={category}>
              {categoryLabel(category)}
            </option>
          ))}
        </Select>
        <Select
          label={t("eventContext")}
          value={selectedEvent}
          onChange={(event) => setSelectedEvent(event.target.value)}
          disabled={busy}
        >
          <option value="">{t("accountIssue")}</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </Select>
        {selectedEvent === eventId && (orderId || ticketId) && (
          <p className="break-all text-label text-text-secondary">
            {orderId && `${t("orderContext", { id: orderId })} `}
            {ticketId && t("ticketContext", { id: ticketId })}
          </p>
        )}
        <Textarea
          label={t("message")}
          name="message"
          required
          maxLength={10000}
          disabled={busy}
        />
        <Button type="submit" loading={busy} className="w-full">
          {t("submit")}
        </Button>
      </form>
    </Modal>
  );
}

/** Reassign a case to the organizer, an authorized support agent, or nobody. */
function CaseAssignment({
  supportCase,
  onUpdated,
}: {
  supportCase: SupportCase;
  onUpdated: () => void;
}) {
  const load = useCallback(
    (signal: AbortSignal) => listCaseAssignees(supportCase.id, { signal }),
    [supportCase.id],
  );
  const people = useApiData(load);
  const [choice, setChoice] = useState(supportCase.assigned_to ?? "");
  const t = useTranslations("supportInbox.assignment");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (people.loading) return <LoadingSpinner label={t("loading")} />;
  if (people.error || !people.data)
    return <ErrorState error={people.error} retry={people.retry} />;
  return (
    <div className="space-y-sm">
      <div className="grid items-end gap-md sm:grid-cols-[1fr_auto]">
        <Select
          label={t("label")}
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          disabled={busy}
        >
          <option value="">{t("unassigned")}</option>
          {people.data.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </Select>
        <Button
          variant="outlined"
          loading={busy}
          disabled={busy || choice === (supportCase.assigned_to ?? "")}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await assignSupportCase(supportCase.id, choice || null);
              onUpdated();
            } catch (error) {
              setError(error);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("assign")}
        </Button>
      </div>
      {supportCase.event_id && (
        <p className="text-label text-text-secondary">{t("staffHint")}</p>
      )}
      {!!error && <ErrorState error={error} />}
    </div>
  );
}
