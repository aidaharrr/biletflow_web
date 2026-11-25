"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EventBanner } from "@/components/events/EventBanner";
import { PaidActivation } from "./PaidActivation";
import {
  attachEventImage,
  createEvent,
  createTicketType,
  getManagedEvent,
  publishEvent,
  updateEvent,
} from "@/lib/api";
import { useApiData } from "@/hooks/useApiData";
import { kazakhstanTime, localDateInput, parseKZT } from "@/lib/organizer";
import { formatKZT } from "@/lib/money";
import type {
  Event,
  EventVisibility,
  EventWrite,
  TicketType,
  TicketTypeWrite,
} from "@/types/api";

interface Details {
  title: string;
  category: string;
  banner: string;
  description: string;
  starts: string;
  ends: string;
  opens: string;
  closes: string;
  venue: string;
  address: string;
  city: string;
  capacity: string;
  visibility: EventVisibility;
  refund: string;
}
interface TicketDraft {
  key: string;
  savedId?: string;
  name: string;
  description: string;
  kind: "free" | "paid";
  price: string;
  quantity: string;
  start: string;
  end: string;
  maximum: string;
}
const blank: Details = {
  title: "",
  category: "tech",
  banner: "",
  description: "",
  starts: "",
  ends: "",
  opens: "",
  closes: "",
  venue: "",
  address: "",
  city: "Almaty",
  capacity: "100",
  visibility: "public",
  refund: "Contact the organizer to request a refund.",
};
/** Looks up a message in the wizard's "errors" section. */
type ErrorText = (key: string) => string;
function ticketDraft(type: TicketType, preserveId: boolean): TicketDraft {
  return {
    key: type.id,
    savedId: preserveId ? type.id : undefined,
    name: type.name,
    description: type.description,
    kind: type.kind,
    price: String(type.price_minor / 100),
    quantity: String(type.quantity),
    start: localDateInput(type.sales_start),
    end: localDateInput(type.sales_end),
    maximum: String(type.max_per_order),
  };
}
function detailsFrom(event: Event): Details {
  return {
    title: event.title,
    category: event.category,
    banner:
      typeof event.images[0] === "string"
        ? event.images[0]
        : (event.images[0]?.url ?? ""),
    description: event.description,
    starts: localDateInput(event.starts_at),
    ends: localDateInput(event.ends_at),
    opens: localDateInput(event.registration_opens_at),
    closes: localDateInput(event.registration_closes_at),
    venue: event.venue.name,
    address: event.venue.address,
    city: event.venue.city ?? "Almaty",
    capacity: String(event.capacity),
    visibility: event.visibility,
    refund: event.refund_policy,
  };
}
function eventBody(details: Details, errorText: ErrorText): EventWrite {
  const starts = kazakhstanTime(details.starts),
    ends = kazakhstanTime(details.ends),
    opens = kazakhstanTime(details.opens),
    closes = kazakhstanTime(details.closes);
  if (Date.parse(starts) <= Date.now())
    throw new Error(errorText("futureStart"));
  if (ends <= starts) throw new Error(errorText("endAfterStart"));
  if (opens >= closes || closes > starts)
    throw new Error(errorText("registrationWindow"));
  const capacity = Number(details.capacity);
  if (!Number.isSafeInteger(capacity) || capacity < 1)
    throw new Error(errorText("capacity"));
  if (details.banner && !/^https?:$/.test(new URL(details.banner).protocol))
    throw new Error(errorText("bannerProtocol"));
  return {
    title: details.title.trim(),
    category: details.category.trim(),
    description: details.description.trim(),
    visibility: details.visibility,
    venue: {
      name: details.venue.trim(),
      address: details.address.trim(),
      city: details.city.trim(),
    },
    starts_at: starts,
    ends_at: ends,
    time_zone: "Asia/Almaty",
    registration_opens_at: opens,
    registration_closes_at: closes,
    capacity,
    admission_type: "general_admission",
    refund_policy: details.refund.trim(),
  };
}
export function EventWizard({
  draftId,
  sourceId,
}: {
  draftId?: string;
  sourceId?: string;
}) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!draftId) return { draft: null, source: null };
      const draft = await getManagedEvent(draftId, { signal });
      const source = sourceId
        ? await getManagedEvent(sourceId, { signal })
        : null;
      return { draft, source };
    },
    [draftId, sourceId],
  );
  const resource = useApiData(load);
  const t = useTranslations("wizard");
  if (resource.loading) return <LoadingSpinner label={t("loading")} />;
  if (resource.error || !resource.data)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  if (
    resource.data.draft &&
    !["draft", "published"].includes(resource.data.draft.status)
  )
    return (
      <Card className="space-y-md">
        <h1 className="text-title">
          {t("locked.title", {
            status: t.has(`locked.status.${resource.data.draft.status}`)
              ? t(`locked.status.${resource.data.draft.status}`)
              : resource.data.draft.status,
          })}
        </h1>
        <Link
          href={`/organizer/events/${resource.data.draft.id}`}
          className="underline"
        >
          {t("locked.open")}
        </Link>
      </Card>
    );
  return (
    <WizardForm draft={resource.data.draft} source={resource.data.source} />
  );
}
function WizardForm({
  draft,
  source,
}: {
  draft: Event | null;
  source: Event | null;
}) {
  const router = useRouter();
  const t = useTranslations("wizard");
  const errorText: ErrorText = (key) => t(`errors.${key}`);
  /** Published events: details only; ticket types are managed on the event page. */
  const editingLive = draft?.status === "published";
  const [step, setStep] = useState(1);
  const [details, setDetails] = useState<Details>(() =>
    draft ? detailsFrom(draft) : { ...blank, refund: t("defaults.refund") },
  );
  const [saved, setSaved] = useState<Event | null>(draft);
  const savedRef = useRef<Event | null>(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [bannerFailed, setBannerFailed] = useState(false);
  const [bannerSkipped, setBannerSkipped] = useState(false);
  const [paidActive, setPaidActive] = useState(
    draft?.paid_sales_status === "active",
  );
  const initialTypes = draft?.available_ticket_types.length
    ? draft.available_ticket_types
    : (source?.available_ticket_types ?? []);
  const [tickets, setTickets] = useState<TicketDraft[]>(() =>
    initialTypes.map((type) =>
      ticketDraft(
        type,
        !!draft?.available_ticket_types.some((saved) => saved.id === type.id),
      ),
    ),
  );
  const keys = useRef<Record<string, { signature: string; value: string }>>({});
  const bannerSaved = useRef(draft ? detailsFrom(draft).banner : "");
  function key(name: string, signature: string) {
    if (keys.current[name]?.signature !== signature)
      keys.current[name] = { signature, value: crypto.randomUUID() };
    return keys.current[name].value;
  }
  const change = (field: keyof Details, value: string) =>
    setDetails((current) => ({ ...current, [field]: value }));
  function patchTicket(
    ticketKey: string,
    field: keyof TicketDraft,
    value: string,
  ) {
    setTickets((current) =>
      current.map((ticket) =>
        ticket.key === ticketKey ? { ...ticket, [field]: value } : ticket,
      ),
    );
  }
  async function saveDetails(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    setBusy(true);
    setError(null);
    setBannerFailed(false);
    try {
      const body = eventBody(details, errorText);
      let event: Event;
      if (savedRef.current) {
        const editable: Partial<EventWrite> = { ...body };
        delete editable.venue;
        delete editable.time_zone;
        delete editable.admission_type;
        event = await updateEvent(savedRef.current.id, editable);
      } else
        event = await createEvent(body, key("event", JSON.stringify(body)));
      savedRef.current = event;
      setSaved(event);
      if (editingLive) {
        if (details.banner && details.banner !== bannerSaved.current) {
          await attachEventImage(event.id, details.banner);
          bannerSaved.current = details.banner;
        }
        router.push(`/organizer/events/${event.id}?updated=1`);
        return;
      }
      // Keep the resumable draft URL without remounting and losing a partially saved form.
      window.history.replaceState(
        null,
        "",
        `/organizer/events/create?draft=${event.id}${source ? `&source=${source.id}` : ""}`,
      );
      if (details.banner && details.banner !== bannerSaved.current) {
        try {
          await attachEventImage(event.id, details.banner);
          bannerSaved.current = details.banner;
        } catch (error) {
          setBannerFailed(true);
          throw error;
        }
      }
      if (!tickets.length)
        setTickets([
          {
            key: "initial",
            name: t("defaults.ticketName"),
            description: "",
            kind: "free",
            price: "0",
            quantity: details.capacity,
            start: details.opens,
            end: details.closes,
            maximum: "10",
          },
        ]);
      setStep(2);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  function ticketBody(row: TicketDraft): TicketTypeWrite {
    const quantity = Number(row.quantity),
      maximum = Number(row.maximum);
    const start = kazakhstanTime(row.start),
      end = kazakhstanTime(row.end);
    if (!row.name.trim()) throw new Error(errorText("ticketName"));
    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      !Number.isSafeInteger(maximum) ||
      maximum < 1 ||
      maximum > 50
    )
      throw new Error(errorText("ticketLimits"));
    if (
      start >= end ||
      start < kazakhstanTime(details.opens) ||
      end > kazakhstanTime(details.closes)
    )
      throw new Error(errorText("ticketSalesWindow"));
    const price = row.kind === "free" ? 0 : parseKZT(row.price);
    if (row.kind === "paid" && price <= 0)
      throw new Error(errorText("paidPrice"));
    return {
      name: row.name.trim(),
      description: row.description.trim(),
      kind: row.kind,
      price_minor: price,
      quantity,
      sales_start: start,
      sales_end: end,
      max_per_order: maximum,
    };
  }
  async function saveTickets(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!savedRef.current || !tickets.length)
        throw new Error(errorText("noTickets"));
      const bodies = tickets.map(ticketBody);
      if (
        bodies.reduce((sum, type) => sum + type.quantity, 0) >
        Number(details.capacity)
      )
        throw new Error(errorText("totalCapacity"));
      const types = [...savedRef.current.available_ticket_types];
      for (let i = 0; i < tickets.length; i++) {
        if (tickets[i].savedId) continue;
        const type = await createTicketType(
          savedRef.current.id,
          bodies[i],
          key(`ticket:${tickets[i].key}`, JSON.stringify(bodies[i])),
        );
        types.push(type);
        setTickets((current) =>
          current.map((row) =>
            row.key === tickets[i].key ? { ...row, savedId: type.id } : row,
          ),
        );
        savedRef.current = {
          ...savedRef.current,
          available_ticket_types: types,
        };
        setSaved(savedRef.current);
      }
      setStep(3);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!saved) return;
    setBusy(true);
    setError(null);
    try {
      const published = await publishEvent(saved.id);
      router.push(`/organizer/events/${published.id}`);
    } catch (error) {
      setError(error);
      setBusy(false);
    }
  }
  const hasPaid = tickets.some((ticket) => ticket.kind === "paid");
  return (
    <>
      <header className="space-y-sm">
        <p className="text-label uppercase tracking-widest text-primary">
          {t("header.eyebrow")}
        </p>
        <h1 className="font-brand text-3xl font-semibold">
          {editingLive
            ? t("header.editLive")
            : draft
              ? t("header.completeDraft")
              : t("header.create")}
        </h1>
        <p className="text-label text-text-secondary">{t("header.subtitle")}</p>
        {editingLive && (
          <p
            role="note"
            className="rounded-input border border-divider bg-background p-md text-label"
          >
            {t("header.liveNote")}
          </p>
        )}
        {saved && !editingLive && (
          <p className="break-all text-label text-text-secondary">
            {t("header.savedDraft", { id: saved.id })}
          </p>
        )}
      </header>
      <ol
        aria-label={t("steps.ariaLabel")}
        className={`grid gap-sm sm:grid-cols-3 ${editingLive ? "hidden" : ""}`}
      >
        {[t("steps.details"), t("steps.tickets"), t("steps.review")].map(
          (label, index) => (
            <li
              key={label}
              aria-current={step === index + 1 ? "step" : undefined}
              className={`rounded-input border px-md py-md text-label ${step === index + 1 ? "border-primary bg-primary/5 font-medium text-primary" : "border-divider bg-surface text-text-secondary"}`}
            >
              {index + 1}. {label}
            </li>
          ),
        )}
      </ol>
      {!!error && <ErrorState error={error} />}{" "}
      {step === 1 && (
        <Card>
          <form onSubmit={saveDetails} className="space-y-lg">
            <div className="grid gap-lg sm:grid-cols-2">
              <Input
                label={t("details.title")}
                value={details.title}
                onChange={(event) => change("title", event.target.value)}
                required
                minLength={3}
                maxLength={250}
                disabled={busy}
              />
              <Input
                label={t("details.category")}
                list="event-categories"
                value={details.category}
                onChange={(event) => change("category", event.target.value)}
                required
                minLength={2}
                maxLength={100}
                disabled={busy}
              />
              <datalist id="event-categories">
                {["concerts", "tech", "student", "sports"].map((value) => (
                  <option
                    key={value}
                    value={value}
                    label={t(`categories.${value}`)}
                  />
                ))}
              </datalist>
            </div>
            <Input
              label={t("details.banner")}
              type="url"
              value={details.banner}
              onChange={(event) => change("banner", event.target.value)}
              placeholder="https://…"
              disabled={busy}
            />
            <Textarea
              label={t("details.description")}
              value={details.description}
              onChange={(event) => change("description", event.target.value)}
              required
              minLength={3}
              disabled={busy}
            />
            <div className="grid gap-lg sm:grid-cols-2">
              {(
                [
                  ["starts", t("details.starts")],
                  ["ends", t("details.ends")],
                  ["opens", t("details.opens")],
                  ["closes", t("details.closes")],
                ] as const
              ).map(([field, label]) => (
                <Input
                  key={field}
                  label={label}
                  type="datetime-local"
                  value={details[field]}
                  onChange={(event) => change(field, event.target.value)}
                  required
                  disabled={busy}
                />
              ))}
            </div>
            <div className="grid gap-lg sm:grid-cols-2">
              <Input
                label={t("details.venue")}
                value={details.venue}
                onChange={(event) => change("venue", event.target.value)}
                required
                minLength={2}
                maxLength={250}
                disabled={busy || !!saved}
              />
              <Input
                label={t("details.city")}
                value={details.city}
                onChange={(event) => change("city", event.target.value)}
                required
                disabled={busy || !!saved}
              />
            </div>
            <Input
              label={t("details.address")}
              value={details.address}
              onChange={(event) => change("address", event.target.value)}
              required
              minLength={3}
              maxLength={500}
              disabled={busy || !!saved}
            />
            {saved && (
              <p className="text-label text-text-secondary">
                {t("details.savedVenueNote")}
              </p>
            )}
            <div className="grid gap-lg sm:grid-cols-2">
              <Input
                label={t("details.capacity")}
                type="number"
                min={1}
                step={1}
                value={details.capacity}
                onChange={(event) => change("capacity", event.target.value)}
                required
                disabled={busy}
              />
              <Select
                label={t("details.visibility")}
                value={details.visibility}
                onChange={(event) => change("visibility", event.target.value)}
                disabled={busy}
              >
                <option value="public">{t("visibility.public")}</option>
                <option value="unlisted">{t("visibility.unlisted")}</option>
                <option value="private">{t("visibility.private")}</option>
              </Select>
            </div>
            <Textarea
              label={t("details.refund")}
              value={details.refund}
              onChange={(event) => change("refund", event.target.value)}
              required
              disabled={busy}
            />
            <Button type="submit" loading={busy}>
              {editingLive
                ? t("actions.saveChanges")
                : t("actions.saveDetails")}
            </Button>
            {editingLive && (
              <Link
                href={`/organizer/events/${draft.id}`}
                className="ml-md text-label underline"
              >
                {t("actions.cancel")}
              </Link>
            )}
            {bannerFailed && (
              <div className="space-y-md">
                <p className="text-label text-text-secondary">
                  {t("bannerFailed")}
                </p>
                <Button
                  variant="outlined"
                  disabled={busy}
                  onClick={() => {
                    setBannerSkipped(true);
                    setDetails((current) => ({ ...current, banner: "" }));
                    setError(null);
                    setBannerFailed(false);
                    if (!tickets.length)
                      setTickets([
                        {
                          key: "initial",
                          name: t("defaults.ticketName"),
                          description: "",
                          kind: "free",
                          price: "0",
                          quantity: details.capacity,
                          start: details.opens,
                          end: details.closes,
                          maximum: "10",
                        },
                      ]);
                    setStep(2);
                  }}
                >
                  {t("actions.continueWithoutBanner")}
                </Button>
              </div>
            )}
          </form>
        </Card>
      )}
      {step === 2 && (
        <form onSubmit={saveTickets} className="space-y-lg">
          {tickets.map((ticket, index) => (
            <Card key={ticket.key} className="space-y-lg">
              <div className="flex items-center justify-between gap-md">
                <h2 className="text-title">
                  {t("tickets.heading", { number: index + 1 })}
                </h2>
                {ticket.savedId ? (
                  <Badge variant="success">{t("tickets.saved")}</Badge>
                ) : (
                  <Button
                    variant="text"
                    disabled={busy}
                    onClick={() =>
                      setTickets((current) =>
                        current.filter((row) => row.key !== ticket.key),
                      )
                    }
                  >
                    {t("tickets.remove", { number: index + 1 })}
                  </Button>
                )}
              </div>
              {ticket.savedId && (
                <p className="text-label text-text-secondary">
                  {t("tickets.savedNote")}
                </p>
              )}
              <div className="grid gap-lg sm:grid-cols-2">
                <Input
                  label={t("tickets.name", { number: index + 1 })}
                  value={ticket.name}
                  onChange={(event) =>
                    patchTicket(ticket.key, "name", event.target.value)
                  }
                  required
                  maxLength={150}
                  disabled={busy || !!ticket.savedId}
                />
                <Select
                  label={t("tickets.kind", { number: index + 1 })}
                  value={ticket.kind}
                  onChange={(event) =>
                    patchTicket(ticket.key, "kind", event.target.value)
                  }
                  disabled={busy || !!ticket.savedId}
                >
                  <option value="free">{t("tickets.kindFree")}</option>
                  <option value="paid">{t("tickets.kindPaid")}</option>
                </Select>
                <Input
                  label={t("tickets.price", { number: index + 1 })}
                  inputMode="decimal"
                  value={ticket.kind === "free" ? "0" : ticket.price}
                  onChange={(event) =>
                    patchTicket(ticket.key, "price", event.target.value)
                  }
                  required
                  disabled={busy || !!ticket.savedId || ticket.kind === "free"}
                />
                <Input
                  label={t("tickets.quantity", { number: index + 1 })}
                  type="number"
                  min={1}
                  step={1}
                  value={ticket.quantity}
                  onChange={(event) =>
                    patchTicket(ticket.key, "quantity", event.target.value)
                  }
                  required
                  disabled={busy || !!ticket.savedId}
                />
                <Input
                  label={t("tickets.salesStart", { number: index + 1 })}
                  type="datetime-local"
                  value={ticket.start}
                  onChange={(event) =>
                    patchTicket(ticket.key, "start", event.target.value)
                  }
                  required
                  disabled={busy || !!ticket.savedId}
                />
                <Input
                  label={t("tickets.salesEnd", { number: index + 1 })}
                  type="datetime-local"
                  value={ticket.end}
                  onChange={(event) =>
                    patchTicket(ticket.key, "end", event.target.value)
                  }
                  required
                  disabled={busy || !!ticket.savedId}
                />
                <Input
                  label={t("tickets.maximum", { number: index + 1 })}
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={ticket.maximum}
                  onChange={(event) =>
                    patchTicket(ticket.key, "maximum", event.target.value)
                  }
                  required
                  disabled={busy || !!ticket.savedId}
                />
              </div>
              <Textarea
                label={t("tickets.description", { number: index + 1 })}
                value={ticket.description}
                onChange={(event) =>
                  patchTicket(ticket.key, "description", event.target.value)
                }
                disabled={busy || !!ticket.savedId}
              />
            </Card>
          ))}
          <div className="flex flex-wrap gap-md">
            <Button
              variant="outlined"
              disabled={busy || tickets.length >= 50}
              onClick={() =>
                setTickets((current) => [
                  ...current,
                  {
                    key: crypto.randomUUID(),
                    name: "",
                    description: "",
                    kind: "paid",
                    price: "",
                    quantity: "1",
                    start: details.opens,
                    end: details.closes,
                    maximum: "10",
                  },
                ])
              }
            >
              {t("actions.addTicketType")}
            </Button>
            <Button
              variant="text"
              disabled={busy}
              onClick={() => {
                setError(null);
                setStep(1);
              }}
            >
              {t("actions.backToDetails")}
            </Button>
            <Button type="submit" disabled={!tickets.length} loading={busy}>
              {t("actions.saveTickets")}
            </Button>
          </div>
        </form>
      )}
      {step === 3 && saved && (
        <>
          <Card className="space-y-lg">
            <h2 className="text-title">{t("review.heading")}</h2>
            <EventBanner
              event={{
                ...saved,
                images: details.banner ? [details.banner] : saved.images,
              }}
              className="aspect-[16/5] min-h-40 rounded-card"
            />
            <h3 className="font-brand text-2xl font-semibold">
              {details.title}
            </h3>
            <p className="text-label text-text-secondary">
              {details.starts.replace("T", " ")} –{" "}
              {details.ends.replace("T", " ")} · UTC+05:00
            </p>
            <p className="text-label">
              {details.venue} · {details.address}
            </p>
            <p className="whitespace-pre-wrap text-label text-text-secondary">
              {details.description}
            </p>
            {tickets.map((ticket) => (
              <div
                key={ticket.key}
                className="flex justify-between gap-md border-t border-divider pt-md text-label"
              >
                <span>
                  {ticket.name} ·{" "}
                  {t("review.ticketCount", {
                    quantity: ticket.quantity,
                    count: Number(ticket.quantity) || 0,
                  })}
                </span>
                <span>
                  {ticket.kind === "free"
                    ? t("review.free")
                    : formatKZT(parseKZT(ticket.price))}
                </span>
              </div>
            ))}
            {bannerSkipped && (
              <p className="text-label text-text-secondary">
                {t("review.noBanner")}
              </p>
            )}
          </Card>
          {hasPaid ? (
            <Card>
              <PaidActivation
                eventId={saved.id}
                onActivated={() => setPaidActive(true)}
              />
            </Card>
          ) : (
            <Card>
              <p className="text-label text-text-secondary">
                {t("review.freeOnly")}
              </p>
            </Card>
          )}
          <div className="flex flex-wrap gap-md">
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() => {
                setError(null);
                setStep(2);
              }}
            >
              {t("actions.backToTickets")}
            </Button>
            <Button
              loading={busy}
              disabled={hasPaid && !paidActive}
              onClick={publish}
            >
              {t("actions.publish")}
            </Button>
            <Link
              href={`/organizer/events/${saved.id}`}
              className="inline-flex min-h-button items-center px-md text-label underline"
            >
              {t("actions.keepDraft")}
            </Link>
          </div>
        </>
      )}
    </>
  );
}
