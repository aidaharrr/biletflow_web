"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { createSupportCase } from "@/lib/api";
import type { SupportCase, SupportCategory } from "@/types/api";

const CATEGORY_LABELS: Partial<Record<SupportCategory, string>> = {
  ticket_delivery: "I didn't receive my ticket",
  payment: "Payment or charge",
  refund: "Refund request",
  seating: "Seating",
  event_information: "Question about the event",
  check_in: "Check-in or QR code problem",
  account: "My account",
  technical: "Technical problem",
  report_event: "Report this event to BiletFlow",
};

/** Attendee entry point for a support case tied to an event, order, or ticket.
 * Cases about an event go to its organizer; event reports go to platform admins.
 */
export function RequestSupport({
  eventId,
  eventTitle,
  orderId,
  ticketId,
  label = "Request support",
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
        Sign in to request support
      </Link>
    );
  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {created && !open && (
        <p role="status" className="text-label text-success">
          Support request {created.number ?? ""} sent.{" "}
          <Link href={`/support?case=${created.id}`} className="underline">
            Follow the conversation
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
  // Refunds need an order; event reports must not carry order or ticket context.
  const categories = (Object.keys(CATEGORY_LABELS) as SupportCategory[]).filter(
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
      setError(new Error("Add a short subject and describe the issue."));
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
    <Modal title="Request support" busy={busy} onClose={onClose}>
      <p className="break-words text-label text-text-secondary">
        {[
          eventTitle ? `Event: ${eventTitle}` : null,
          orderId ? `Order ${orderId.slice(0, 8)}` : null,
          ticketId ? `Ticket ${ticketId.slice(0, 8)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="text-label text-text-secondary">
        {category === "report_event"
          ? "Reports go to BiletFlow platform administrators, not the organizer."
          : "Your request goes to the event organizer's support team. You'll see their replies under Support."}
      </p>
      {!!error && <ErrorState error={error} />}
      <form onSubmit={submit} className="space-y-md">
        <Select
          label="What do you need help with?"
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as SupportCategory)
          }
          disabled={busy}
        >
          {categories.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </option>
          ))}
        </Select>
        <Input
          label="Subject"
          name="subject"
          required
          minLength={3}
          maxLength={200}
          disabled={busy}
        />
        <Textarea
          label="Describe the issue"
          name="message"
          required
          maxLength={10000}
          disabled={busy}
        />
        <Button type="submit" loading={busy} className="w-full">
          Send support request
        </Button>
      </form>
    </Modal>
  );
}
