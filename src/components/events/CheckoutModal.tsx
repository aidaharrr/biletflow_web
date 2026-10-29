"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  cancelCheckoutSession,
  createCheckoutSession,
  completeCheckoutSession,
} from "@/lib/api";
import { formatKZT } from "@/lib/money";
import type {
  CheckoutItem,
  CheckoutRequest,
  Event,
  Order,
  User,
} from "@/types/api";

export function CheckoutModal({
  event,
  items,
  promoCode,
  user,
  onClose,
}: {
  event: Event;
  items: CheckoutItem[];
  promoCode: string;
  user: User;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [now, setNow] = useState(() => Date.now());
  const createKey = useRef<{ signature: string; key: string } | null>(null);
  const completionKey = useRef<string | null>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    if (!order) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [order]);
  async function reserve(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    const form = new FormData(submit.currentTarget);
    const body: CheckoutRequest = {
      event_id: event.id,
      items,
      attendee_name: String(form.get("name")).trim(),
      attendee_email: String(form.get("email")).trim(),
      ...(promoCode ? { promo_code: promoCode } : {}),
    };
    const signature = JSON.stringify(body);
    if (createKey.current?.signature !== signature)
      createKey.current = { signature, key: crypto.randomUUID() };
    setPending(true);
    setError(null);
    try {
      setOrder(await createCheckoutSession(body, createKey.current.key));
    } catch (error) {
      setError(error);
    } finally {
      setPending(false);
    }
  }
  async function complete() {
    if (!order || pending) return;
    completionKey.current ??= crypto.randomUUID();
    setPending(true);
    setError(null);
    try {
      const confirmed = await completeCheckoutSession(
        order.id,
        completionKey.current,
      );
      if (confirmed.status !== "confirmed")
        throw new Error(
          "Checkout was not completed. Your tickets have not been issued.",
        );
      router.push(`/orders/${confirmed.id}`);
    } catch (error) {
      setError(error);
      setPending(false);
    }
  }
  function close() {
    // Release reserved tickets (and any promo hold) instead of waiting for expiry.
    if (order?.status === "pending")
      cancelCheckoutSession(order.id).catch(() => undefined);
    onClose();
  }
  const seconds = order
    ? Math.max(0, Math.floor((Date.parse(order.expires_at) - now) / 1000))
    : 0;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="checkout-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-[32rem] rounded-card border border-divider bg-surface p-0 text-text-primary shadow-xl backdrop:bg-brand-dark/50"
    >
      <div className="max-h-[90dvh] overflow-y-auto p-lg sm:p-xl">
        <div className="mb-lg flex items-start justify-between gap-md">
          <div>
            <h2
              id="checkout-title"
              className="font-brand text-2xl font-semibold"
            >
              {order ? "Review your booking" : "Your attendee details"}
            </h2>
            <p className="mt-sm text-label text-text-secondary">
              {event.title}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close checkout"
            disabled={pending}
            onClick={close}
            className="rounded-input p-sm text-xl disabled:opacity-disabled"
          >
            ×
          </button>
        </div>
        {!!error && (
          <div className="mb-lg">
            <ErrorState error={error} />
          </div>
        )}
        {!order ? (
          <form className="space-y-lg" onSubmit={reserve}>
            <Input
              label="Full name"
              name="name"
              defaultValue={user.full_name ?? ""}
              required
              minLength={2}
              maxLength={200}
              autoComplete="name"
              disabled={pending}
            />
            <Input
              label="Email"
              name="email"
              type="email"
              defaultValue={user.email}
              required
              autoComplete="email"
              disabled={pending}
              helperText="Your tickets will be associated with this attendee."
            />
            {promoCode && (
              <p className="text-label text-text-secondary">
                Promo code:{" "}
                <strong className="text-text-primary">{promoCode}</strong>
              </p>
            )}
            <p className="text-label text-text-secondary">
              Review the final total before confirming. Paid bookings use a demo
              payment; no real money is charged.
            </p>
            <Button
              type="submit"
              className="w-full"
              loading={pending}
              loadingLabel="Reserving tickets"
            >
              Reserve and review
            </Button>
          </form>
        ) : (
          <div className="space-y-lg">
            <p className="text-label">
              {order.attendee_name} · {order.attendee_email}
            </p>
            <div className="space-y-sm border-y border-divider py-md">
              {(order.items ?? items).map((item) => {
                const type = event.available_ticket_types.find(
                  (type) => type.id === item.ticket_type_id,
                );
                return (
                  <div
                    key={item.ticket_type_id}
                    className="flex justify-between gap-md text-label"
                  >
                    <span>
                      {item.quantity} × {type?.name ?? "Ticket"}
                    </span>
                    {"unit_price_minor" in item &&
                      typeof item.unit_price_minor === "number" && (
                        <span>
                          {formatKZT(item.quantity * item.unit_price_minor)}
                        </span>
                      )}
                  </div>
                );
              })}
            </div>
            <dl className="space-y-sm text-label">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatKZT(order.subtotal_minor)}</dd>
              </div>
              {order.discount_minor > 0 && (
                <div className="flex justify-between">
                  <dt>
                    Discount
                    {(order.promo_code ?? promoCode)
                      ? ` (${order.promo_code ?? promoCode})`
                      : ""}
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
            <p role="status" className="text-label text-text-secondary">
              {seconds
                ? `Reservation expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}.`
                : "This reservation has expired. Close checkout and select your tickets again."}
            </p>
            {order.total_minor > 0 && (
              <p className="rounded-input bg-background p-md text-label text-text-secondary">
                Demo payment · No card details or real money required.
              </p>
            )}
            <Button
              className="w-full"
              loading={pending}
              disabled={!seconds}
              onClick={complete}
              loadingLabel="Confirming your booking"
            >
              {order.total_minor === 0
                ? "Confirm free registration"
                : `Confirm demo payment · ${formatKZT(order.total_minor)}`}
            </Button>
          </div>
        )}
      </div>
    </dialog>
  );
}
