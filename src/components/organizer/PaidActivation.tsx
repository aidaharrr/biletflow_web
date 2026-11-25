"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("paidActivation");
  const load = useCallback(
    (signal: AbortSignal) => getPaidSales(eventId, { signal }),
    [eventId],
  );
  const resource = useApiData(load);
  // Approval happens elsewhere (admin portal), so unlock publishing whenever a
  // (re)load finds paid sales active, not only right after our own request.
  // Fire only on a transition into "active": callers may reload on activation
  // (EventAnalytics passes resource.retry), so firing on every render would loop.
  const loadedStatus = resource.data?.status;
  const lastStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!loadedStatus) return;
    const previous = lastStatus.current;
    lastStatus.current = loadedStatus;
    if (loadedStatus === "active" && previous && previous !== "active")
      onActivated?.();
  }, [loadedStatus, onActivated]);
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
      setError(new Error(t("payout.invalid")));
      return;
    }
    await act("payout", () => connectSandboxPayout(reference));
  }
  const key = (name: string) => (keys.current[name] ??= crypto.randomUUID());
  if (resource.loading) return <LoadingSpinner label={t("loading")} />;
  if (resource.error || !resource.data)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  const { checklist, status, can_activate, review_status, review_reason } =
    resource.data;
  const awaitingReview =
    status === "pending_review" || review_status === "pending_review";
  const statusText = (value: string) =>
    t.has(`status.${value}`) ? t(`status.${value}`) : value.replace(/_/g, " ");
  if (status === "active")
    return (
      <section className="space-y-md" aria-label={t("ariaLabel")}>
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-title">{t("heading")}</h2>
          <Badge variant="success">{t("active")}</Badge>
        </div>
        <p className="text-label text-text-secondary">{t("activeNote")}</p>
      </section>
    );
  if (status === "suspended")
    return (
      <section className="space-y-md" aria-label={t("ariaLabel")}>
        <h2 className="text-title">{t("suspendedHeading")}</h2>
        <p role="alert" className="text-label text-error">
          {t("suspendedNote")}
        </p>
      </section>
    );
  return (
    <section className="space-y-lg" aria-label={t("ariaLabel")}>
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h2 className="text-title">{t("heading")}</h2>
        <Badge
          variant={
            status === "rejected" || review_status === "changes_required"
              ? "error"
              : "neutral"
          }
        >
          {awaitingReview
            ? t("status.awaitingReview")
            : review_status === "changes_required"
              ? t("status.changesRequired")
              : statusText(status)}
        </Badge>
      </div>
      <p className="text-label text-text-secondary">{t("intro")}</p>
      {awaitingReview && (
        <p
          role="status"
          className="rounded-input border border-success/30 bg-success/5 p-md text-label"
        >
          {t("review.submitted")}{" "}
          <button
            type="button"
            className="font-medium underline"
            onClick={resource.retry}
          >
            {t("review.checkStatus")}
          </button>
        </p>
      )}
      {(status === "rejected" || review_status === "changes_required") && (
        <div
          role="alert"
          className="space-y-xs rounded-input border border-error/30 bg-error/5 p-md text-label"
        >
          <p className="font-medium">
            {review_status === "changes_required"
              ? t("review.changesRequired")
              : t("review.rejected")}
          </p>
          {review_reason && (
            <p className="whitespace-pre-wrap break-words">{review_reason}</p>
          )}
        </div>
      )}
      {!!error && <ErrorState error={error} />}
      <ul className="grid gap-sm text-label sm:grid-cols-2">
        {Object.entries({
          [t("checklist.hasPaidTicket")]: checklist.has_paid_ticket,
          [t("checklist.identityVerified")]: checklist.identity_verified,
          [t("checklist.payoutConnected")]: checklist.payout_connected,
          [t("checklist.activationFeePaid")]: checklist.activation_fee_paid,
          [t("checklist.termsAccepted")]: checklist.terms_accepted,
        }).map(([label, complete]) => (
          <li className="flex items-center gap-sm" key={label}>
            <span
              className={complete ? "text-success" : "text-text-tertiary"}
              aria-hidden="true"
            >
              {complete ? "✓" : "○"}
            </span>
            {t("checklist.item", {
              label,
              state: complete
                ? t("checklist.complete")
                : t("checklist.pending"),
            })}
          </li>
        ))}
      </ul>
      {!checklist.identity_verified && (
        <Card>
          <form onSubmit={verify} className="space-y-md">
            <h3 className="font-medium">{t("identity.heading")}</h3>
            <Input
              label={t("identity.contact")}
              name="contact"
              defaultValue={user?.full_name ?? ""}
              required
              minLength={2}
              maxLength={200}
              disabled={!!busy}
            />
            <Input
              label={t("identity.organization")}
              name="organization"
              maxLength={200}
              disabled={!!busy}
            />
            <Input
              label={t("identity.phone")}
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
              {t("identity.submit")}
            </Button>
          </form>
        </Card>
      )}
      {checklist.identity_verified && !checklist.payout_connected && (
        <Card>
          <form onSubmit={payout} className="space-y-md">
            <h3 className="font-medium">{t("payout.heading")}</h3>
            <Input
              label={t("payout.reference")}
              name="reference"
              placeholder="DEMO-0001"
              required
              pattern="DEMO-[A-Za-z0-9-]{4,40}"
              helperText={t("payout.helper")}
              disabled={!!busy}
            />
            <Button type="submit" loading={busy === "payout"} disabled={!!busy}>
              {t("payout.submit")}
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
            <span>{t("terms.text")}</span>
          </label>
          <Button
            variant="outlined"
            disabled={!terms || !!busy}
            loading={busy === "terms"}
            onClick={() => act("terms", () => acceptPaidTerms(eventId))}
          >
            {t("terms.accept")}
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
                throw new Error(t("fee.failed"));
              setReceipt(
                t("fee.receipt", {
                  amount: formatKZT(result.amount_minor),
                }),
              );
            })
          }
        >
          {t("fee.pay")}
        </Button>
      )}
      {receipt && (
        <p role="status" className="text-label text-success">
          {receipt}
        </p>
      )}
      <Button
        disabled={
          !!busy ||
          !can_activate ||
          awaitingReview ||
          ["active", "suspended"].includes(status)
        }
        loading={busy === "activate"}
        onClick={() =>
          act("activate", async () => {
            // The backend submits the event for admin review ("pending_review");
            // "active" is only returned when an approved review is still current.
            const result = await activatePaidSales(eventId, key("activate"));
            delete keys.current.activate;
            if (result.status === "active") onActivated?.();
            else if (result.status !== "pending_review")
              throw new Error(t("submit.failed"));
          })
        }
      >
        {awaitingReview ? t("submit.waiting") : t("submit.submit")}
      </Button>
    </section>
  );
}
