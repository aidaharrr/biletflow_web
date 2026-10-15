"use client";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge, Button, Card, Input } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  acceptPaidTerms,
  activatePaidSales,
  connectSandboxPayout,
  getPaidSales,
  payActivationFee,
  saveOrganizerProfile,
  verifyOrganizerProfile,
} from "@/lib/api";
import { useApiData } from "@/hooks/useApiData";
import { formatKZT } from "@/lib/money";
export function PaidActivation({
  eventId,
  onActivated,
}: {
  eventId: string;
  onActivated?: () => void;
}) {
  const { user } = useAuth();
  const load = useCallback(
    (signal: AbortSignal) => getPaidSales(eventId, { signal }),
    [eventId],
  );
  const resource = useApiData(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [terms, setTerms] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const keys = useRef<Record<string, string>>({});
  async function act(name: string, action: () => Promise<unknown>) {
    setBusy(name);
    setError(null);
    try {
      await action();
      resource.retry();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(null);
    }
  }
  async function verify(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    const form = new FormData(submit.currentTarget);
    await act("identity", async () => {
      await saveOrganizerProfile({
        contact_name: String(form.get("contact")).trim(),
        organization_name: String(form.get("organization")).trim() || null,
        contact_phone: String(form.get("phone")).trim() || null,
      });
      await verifyOrganizerProfile();
    });
  }
  async function payout(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    const reference = String(
      new FormData(submit.currentTarget).get("reference"),
    ).trim();
    if (!/^DEMO-[A-Za-z0-9-]{4,40}$/.test(reference)) {
      setError(new Error("Use a sandbox reference such as DEMO-0001."));
      return;
    }
    await act("payout", () => connectSandboxPayout(reference));
  }
  const key = (name: string) => (keys.current[name] ??= crypto.randomUUID());
  if (resource.loading)
    return <LoadingSpinner label="Checking paid-sales requirements…" />;
  if (resource.error || !resource.data)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  const { checklist, status, can_activate } = resource.data;
  if (status === "active")
    return (
      <section className="space-y-md" aria-label="Paid sales activation">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-title">Paid sales activation checklist</h2>
          <Badge variant="success">Active</Badge>
        </div>
        <p className="text-label text-text-secondary">
          Paid sales are activated for this event. Checkout and payout records
          remain simulated; no real money is charged.
        </p>
      </section>
    );
  if (status === "suspended")
    return (
      <section className="space-y-md" aria-label="Paid sales activation">
        <h2 className="text-title">Paid sales suspended</h2>
        <p role="alert" className="text-label text-error">
          Contact platform support to review this suspension. Further activation
          payments are unavailable here.
        </p>
      </section>
    );
  return (
    <section className="space-y-lg" aria-label="Paid sales activation">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h2 className="text-title">Paid sales activation checklist</h2>
        <Badge variant="neutral">{status.replace(/_/g, " ")}</Badge>
      </div>
      <p className="text-label text-text-secondary">
        Sandbox verification, payout connection, and activation fees apply to
        this event. No real identity documents, bank details, or payments are
        required.
      </p>
      {!!error && <ErrorState error={error} />}
      <ul className="grid gap-sm text-label sm:grid-cols-2">
        {Object.entries({
          "Paid ticket configured": checklist.has_paid_ticket,
          "Sandbox identity verified": checklist.identity_verified,
          "Sandbox payout connected": checklist.payout_connected,
          "Activation fee recorded": checklist.activation_fee_paid,
          "Terms accepted": checklist.terms_accepted,
        }).map(([label, complete]) => (
          <li className="flex items-center gap-sm" key={label}>
            <span
              className={complete ? "text-success" : "text-text-tertiary"}
              aria-hidden="true"
            >
              {complete ? "✓" : "○"}
            </span>
            {label}: {complete ? "Complete" : "Pending"}
          </li>
        ))}
      </ul>
      {!checklist.identity_verified && (
        <Card>
          <form onSubmit={verify} className="space-y-md">
            <h3 className="font-medium">1. Verify sandbox identity</h3>
            <Input
              label="Organizer contact name"
              name="contact"
              defaultValue={user?.full_name ?? ""}
              required
              minLength={2}
              maxLength={200}
              disabled={!!busy}
            />
            <Input
              label="Organization name (optional)"
              name="organization"
              maxLength={200}
              disabled={!!busy}
            />
            <Input
              label="Contact phone (optional)"
              name="phone"
              type="tel"
              maxLength={40}
              disabled={!!busy}
            />
            <Button
              type="submit"
              loading={busy === "identity"}
              disabled={!!busy}
            >
              Verify sandbox identity
            </Button>
          </form>
        </Card>
      )}
      {checklist.identity_verified && !checklist.payout_connected && (
        <Card>
          <form onSubmit={payout} className="space-y-md">
            <h3 className="font-medium">2. Connect sandbox payout</h3>
            <Input
              label="Sandbox payout reference"
              name="reference"
              placeholder="DEMO-0001"
              required
              pattern="DEMO-[A-Za-z0-9-]{4,40}"
              helperText="Use a demonstration reference only."
              disabled={!!busy}
            />
            <Button type="submit" loading={busy === "payout"} disabled={!!busy}>
              Connect sandbox payout
            </Button>
          </form>
        </Card>
      )}
      {!checklist.terms_accepted && (
        <Card className="space-y-md">
          <label className="flex items-start gap-md text-label">
            <input
              type="checkbox"
              checked={terms}
              onChange={(event) => setTerms(event.target.checked)}
              disabled={!!busy}
              className="mt-1 size-5 shrink-0 accent-primary"
            />
            <span>
              I accept the sandbox paid-event terms: this demonstration charges
              no real money and produces no real payouts. I am responsible for
              event information and the stated refund policy.
            </span>
          </label>
          <Button
            variant="outlined"
            disabled={!terms || !!busy}
            loading={busy === "terms"}
            onClick={() => act("terms", () => acceptPaidTerms(eventId))}
          >
            Accept paid-event terms
          </Button>
        </Card>
      )}
      {!checklist.activation_fee_paid && (
        <Button
          variant="outlined"
          disabled={
            !!busy ||
            !checklist.identity_verified ||
            !checklist.payout_connected ||
            !checklist.terms_accepted
          }
          loading={busy === "fee"}
          onClick={() =>
            act("fee", async () => {
              const result = await payActivationFee(eventId, key("fee"));
              if (result.status !== "succeeded")
                throw new Error("Activation fee payment was not successful.");
              setReceipt(
                `Simulated activation fee recorded: ${formatKZT(result.amount_minor)}. No real money charged.`,
              );
            })
          }
        >
          Pay simulated activation fee
        </Button>
      )}
      {receipt && (
        <p role="status" className="text-label text-success">
          {receipt}
        </p>
      )}
      <Button
        disabled={
          !!busy || !can_activate || ["active", "suspended"].includes(status)
        }
        loading={busy === "activate"}
        onClick={() =>
          act("activate", async () => {
            const result = await activatePaidSales(eventId, key("activate"));
            if (result.status !== "active")
              throw new Error("Paid sales were not activated.");
            onActivated?.();
          })
        }
      >
        Activate paid sales for this event
      </Button>
    </section>
  );
}
