"use client";
import { useCallback, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useIntlLocale } from "@/i18n/labels";
import { Badge, Button, Card, Modal, Select, Textarea } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AdminErrorState, AdminHeader } from "@/components/admin/AdminStates";
import { useAdmin, useAdminRequestKey } from "@/components/admin/AdminShell";
import {
  decidePaidEventApplication,
  getPaidEventApplications,
} from "@/lib/api";
import { dateLabel } from "@/lib/organizer";
import { useApiData } from "@/hooks/useApiData";
import type { PaidEventApplication } from "@/types/api";

function canDecide(item: PaidEventApplication) {
  return item.status === "pending_review" && item.event.status === "draft";
}

function requirements(item: PaidEventApplication) {
  return {
    identity: item.profile?.verification_status === "verified",
    payout: !!item.profile?.payout_verified,
    fee: item.activation_fee_paid,
    terms: item.terms_accepted,
  };
}

export default function AdminPaidEvents() {
  const t = useTranslations("admin.paidEvents");
  const locale = useIntlLocale();
  const statusText = (value: string) =>
    t.has(`status.${value}`) ? t(`status.${value}`) : value;
  const eventStatusText = (value: string) =>
    t.has(`eventStatus.${value}`) ? t(`eventStatus.${value}`) : value;
  const { mode, revision, refresh } = useAdmin();
  const [status, setStatus] = useState<string>("pending_review");
  const [review, setReview] = useState<{
    item: PaidEventApplication;
    action: "review" | "reject";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const requestKey = useAdminRequestKey();
  const load = useCallback(
    (signal: AbortSignal) => {
      void revision;
      return mode === "demo"
        ? Promise.resolve([] as PaidEventApplication[])
        : getPaidEventApplications({ signal });
    },
    [mode, revision],
  );
  const resource = useApiData(load);

  async function decide(decision: "approve" | "reject", reason = "") {
    if (!review) return;
    setBusy(true);
    setError(null);
    try {
      const id = review.item.event.id;
      const result = await decidePaidEventApplication(
        id,
        decision,
        reason,
        requestKey(`${decision}:${id}:${reason}`),
      );
      const expected = decision === "approve" ? "approved" : "rejected";
      if (result.status !== expected) throw new Error(t("notConfirmed"));
      setNotice(
        decision === "approve"
          ? t("approvedNotice", { title: review.item.event.title })
          : t("rejectedNotice", { title: review.item.event.title }),
      );
      setReview(null);
      refresh();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(
      new FormData(event.currentTarget).get("reason"),
    ).trim();
    if (reason.length < 3) {
      setError(new Error(t("reasonRequired")));
      return;
    }
    await decide("reject", reason);
  }

  const header = (
    <AdminHeader
      title={t("title")}
      description={t("description")}
      action={
        <Button variant="outlined" onClick={resource.retry}>
          {t("refresh")}
        </Button>
      }
    />
  );
  if (mode === "demo")
    return (
      <>
        {header}
        <Card className="space-y-sm">
          <h2 className="text-title">{t("liveOnlyTitle")}</h2>
          <p className="text-label text-text-secondary">{t("liveOnlyBody")}</p>
        </Card>
      </>
    );
  if (resource.loading) return <LoadingSpinner label={t("loading")} />;
  if (resource.error || !resource.data)
    return (
      <>
        {header}
        <AdminErrorState error={resource.error} retry={resource.retry} />
      </>
    );
  const shown = resource.data.filter(
    (item) => !status || item.status === status,
  );
  return (
    <>
      {header}
      {notice && (
        <p
          role="status"
          className="rounded-input border border-success/30 bg-success/5 p-md text-label"
        >
          {notice}
        </p>
      )}
      <Select
        label={t("statusLabel")}
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="pending_review">{t("status.pending_review")}</option>
        <option value="approved">{t("status.approved")}</option>
        <option value="rejected">{t("status.rejected")}</option>
        <option value="changes_required">{t("status.changes_required")}</option>
        <option value="">{t("allReviews")}</option>
      </Select>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-label">
            <thead className="border-b border-divider bg-background text-text-secondary">
              <tr>
                {(
                  [
                    "event",
                    "organizer",
                    "checklist",
                    "status",
                    "actions",
                  ] as const
                ).map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="px-lg py-md font-medium"
                  >
                    {t(`columns.${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => {
                const checks = Object.values(requirements(item));
                return (
                  <tr
                    key={item.event.id}
                    className="border-b border-divider last:border-0"
                  >
                    <td className="px-lg py-lg">
                      <p className="font-medium">{item.event.title}</p>
                      <p className="mt-xs text-text-secondary">
                        {t("starts", {
                          date: dateLabel(item.event.starts_at, locale),
                        })}
                      </p>
                      <p className="mt-xs text-text-secondary">
                        {t("submitted", {
                          date: dateLabel(item.submitted_at, locale),
                        })}
                      </p>
                    </td>
                    <td className="px-lg py-lg">
                      <p>{item.profile?.contact_name ?? t("noProfile")}</p>
                      <p className="mt-xs text-text-secondary">
                        {item.profile?.organization_name ?? ""}
                      </p>
                    </td>
                    <td className="px-lg py-lg">
                      {t("checksComplete", {
                        done: checks.filter(Boolean).length,
                        total: checks.length,
                      })}
                    </td>
                    <td className="px-lg py-lg">
                      <Badge
                        variant={
                          item.status === "approved"
                            ? "success"
                            : item.status === "rejected" ||
                                item.status === "changes_required"
                              ? "error"
                              : "neutral"
                        }
                      >
                        {statusText(item.status)}
                      </Badge>
                    </td>
                    <td className="px-lg py-md">
                      <div className="flex flex-wrap gap-sm">
                        <Button
                          variant="outlined"
                          className="px-sm text-label"
                          onClick={() => {
                            setError(null);
                            setReview({ item, action: "review" });
                          }}
                        >
                          {canDecide(item) ? t("review") : t("details")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!shown.length && (
            <div className="space-y-sm p-xl">
              <h2 className="text-title">{t("emptyTitle")}</h2>
              <p className="text-label text-text-secondary">{t("emptyBody")}</p>
            </div>
          )}
        </div>
      </Card>
      {review && (
        <Modal
          title={
            review.action === "reject"
              ? t("rejectModalTitle")
              : t("reviewModalTitle")
          }
          busy={busy}
          onClose={() => {
            setReview(null);
            setError(null);
          }}
        >
          <div className="space-y-sm">
            <h3 className="text-title">{review.item.event.title}</h3>
            <p className="text-label text-text-secondary">
              {t("startsWithStatus", {
                date: dateLabel(review.item.event.starts_at, locale),
                status: eventStatusText(review.item.event.status),
              })}
            </p>
            <Badge>{statusText(review.item.status)}</Badge>
          </div>
          <dl className="grid gap-md text-label sm:grid-cols-2">
            {[
              ["contact", review.item.profile?.contact_name],
              ["organization", review.item.profile?.organization_name],
              ["contactPhone", review.item.profile?.contact_phone],
              ["payoutAccount", review.item.profile?.payout_account_masked],
              ["refundPolicy", review.item.event.refund_policy],
            ].map(([field, value]) => (
              <div key={field}>
                <dt className="text-text-secondary">{t(`fields.${field}`)}</dt>
                <dd className="mt-xs break-words">
                  {value || t("notSupplied")}
                </dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-sm text-label">
            {Object.entries(requirements(review.item)).map(([key, done]) => (
              <li key={key} className="flex items-start gap-sm">
                <span
                  aria-hidden="true"
                  className={done ? "text-success" : "text-text-tertiary"}
                >
                  {done ? "✓" : "○"}
                </span>
                {t("requirement", {
                  label: t(`requirements.${key}`),
                  state: done ? t("complete") : t("pending"),
                })}
              </li>
            ))}
          </ul>
          {review.item.reason && (
            <Card className="space-y-sm">
              <p className="text-label font-medium">{t("reviewNote")}</p>
              <p className="whitespace-pre-wrap break-words text-label">
                {review.item.reason}
              </p>
            </Card>
          )}
          {!!error && <ErrorState error={error} />}
          {review.action === "reject" ? (
            <form onSubmit={reject} className="space-y-md">
              <Textarea
                label={t("reasonLabel")}
                name="reason"
                required
                minLength={3}
                maxLength={2000}
                disabled={busy}
              />
              <Button type="submit" loading={busy} className="w-full bg-error">
                {t("confirmRejection")}
              </Button>
            </form>
          ) : (
            canDecide(review.item) && (
              <div className="flex flex-wrap gap-md">
                <Button
                  loading={busy}
                  disabled={busy}
                  onClick={() => decide("approve")}
                >
                  {t("approve")}
                </Button>
                <Button
                  variant="outlined"
                  disabled={busy}
                  onClick={() => setReview({ ...review, action: "reject" })}
                >
                  {t("reject")}
                </Button>
              </div>
            )
          )}
        </Modal>
      )}
    </>
  );
}
