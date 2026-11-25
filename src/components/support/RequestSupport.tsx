"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { createSupportCase } from "@/lib/api";
import type { SupportCase, SupportCategory } from "@/types/api";
import { useTranslations } from "next-intl";

/** Categories an attendee can pick; labels are in support.RequestSupport.categories. */
const CATEGORIES: SupportCategory[] = [
  "ticket_delivery",
  "payment",
  "refund",
  "seating",
  "event_information",
  "check_in",
  "account",
  "technical",
  "report_event",
];

/** Attendee entry point for a support case tied to an event, order, or ticket.
 * Cases about an event go to its organizer; event reports go to platform admins.
 */
export function RequestSupport({
  eventId,
  eventTitle,
  orderId,
  ticketId,
  label,
  variant = "outlined",
  className,
}: {
  eventId: string;
  eventTitle?: string;
  orderId?: string;
  ticketId?: string;
  label?: string;
  variant?: "outlined" | "text" | "primary";
  className?: string;
}) {
  const t = useTranslations("support");
  const { user, loading } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<SupportCase | null>(null);
  if (loading) return null;
  if (!user)
    return (
      <Link
        href={`/login?next=${encodeURIComponent(path)}`}
        className="inline-block text-label font-medium underline"
      >
        {t("RequestSupport.signInToRequest")}
      </Link>
    );
  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        {label ?? t("RequestSupport.button")}
      </Button>
      {created && !open && (
        <p role="status" className="text-label text-success">
          {t("RequestSupport.sent", { number: created.number ?? "" })}{" "}
          <Link href={`/support?case=${created.id}`} className="underline">
            {t("RequestSupport.follow")}
          </Link>
        </p>
      )}
      {open && (
        <SupportForm
          eventId={eventId}
          eventTitle={eventTitle}
          orderId={orderId}
          ticketId={ticketId}
          onClose={() => setOpen(false)}
          onCreated={(item) => {
            setCreated(item);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function SupportForm({
  eventId,
  eventTitle,
  orderId,
  ticketId,
  onClose,
  onCreated,
}: {
  eventId: string;
  eventTitle?: string;
  orderId?: string;
  ticketId?: string;
  onClose: () => void;
  onCreated: (item: SupportCase) => void;
}) {
  const t = useTranslations("support");
  // Refunds need an order; event reports must not carry order or ticket context.
  const categories = CATEGORIES.filter(
    (category) =>
      (category !== "refund" || !!orderId) &&
      (category !== "report_event" || (!orderId && !ticketId)),
  );
  const [category, setCategory] = useState<SupportCategory>(
    ticketId ? "check_in" : orderId ? "ticket_delivery" : "event_information",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const request = useRef<{ signature: string; key: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      flow: "attendee" as const,
      category,
      subject: String(form.get("subject")).trim(),
      message: String(form.get("message")).trim(),
      event_id: eventId,
      ...(orderId ? { order_id: orderId } : {}),
      ...(ticketId ? { ticket_id: ticketId } : {}),
    };
    if (body.subject.length < 3 || !body.message) {
      setError(new Error(t("RequestSupport.invalid")));
      return;
    }
    const signature = JSON.stringify(body);
    if (request.current?.signature !== signature)
      request.current = { signature, key: crypto.randomUUID() };
    setBusy(true);
    setError(null);
    try {
      onCreated(await createSupportCase(body, request.current.key));
    } catch (error) {
      setError(error);
      setBusy(false);
    }
  }

  return (
    <Modal title={t("RequestSupport.modalTitle")} busy={busy} onClose={onClose}>
      <p className="break-words text-label text-text-secondary">
        {[
          eventTitle
            ? t("RequestSupport.contextEvent", { title: eventTitle })
            : null,
          orderId
            ? t("RequestSupport.contextOrder", { id: orderId.slice(0, 8) })
            : null,
          ticketId
            ? t("RequestSupport.contextTicket", { id: ticketId.slice(0, 8) })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="text-label text-text-secondary">
        {category === "report_event"
          ? t("RequestSupport.reportNote")
          : t("RequestSupport.organizerNote")}
      </p>
      {!!error && <ErrorState error={error} />}
      <form onSubmit={submit} className="space-y-md">
        <Select
          label={t("RequestSupport.categoryLabel")}
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as SupportCategory)
          }
          disabled={busy}
        >
          {categories.map((value) => (
            <option key={value} value={value}>
              {t(`RequestSupport.categories.${value}`)}
            </option>
          ))}
        </Select>
        <Input
          label={t("RequestSupport.subject")}
          name="subject"
          required
          minLength={3}
          maxLength={200}
          disabled={busy}
        />
        <Textarea
          label={t("RequestSupport.message")}
          name="message"
          required
          maxLength={10000}
          disabled={busy}
        />
        <Button type="submit" loading={busy} className="w-full">
          {t("RequestSupport.submit")}
        </Button>
      </form>
    </Modal>
  );
}
