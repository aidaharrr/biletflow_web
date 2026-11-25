"use client";
import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useIntlLocale, useLabel } from "@/i18n/labels";
import { Badge, Button, Card, Modal, Select, Textarea } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AdminErrorState, AdminHeader } from "@/components/admin/AdminStates";
import { useAdmin, useAdminRequestKey } from "@/components/admin/AdminShell";
import { approvalRequirements, canApproveOrganizer } from "@/lib/admin";
import { dateLabel } from "@/lib/organizer";
import { useApiData } from "@/hooks/useApiData";
import type { OrganizerApplication } from "@/types/api";
export default function AdminOrganizers() {
  const t = useTranslations("admin.organizers");
  const label = useLabel();
  const locale = useIntlLocale();
  const statusText = (value: string) =>
    t.has(`status.${value}`) ? t(`status.${value}`) : value;
  const verificationText = (value: string) =>
    t.has(`verification.${value}`)
      ? t(`verification.${value}`)
      : value.replace(/_/g, " ");
  const { api, mode, revision, refresh, href } = useAdmin();
  const [status, setStatus] = useState("pending");
  const [review, setReview] = useState<{
    item: OrganizerApplication;
    action: "review" | "approve" | "reject";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const requestKey = useAdminRequestKey();
  const load = useCallback(
    (signal: AbortSignal) => {
      void revision;
      return api.getOrganizerApplications({ signal });
    },
    [api, revision],
  );
  const resource = useApiData(load);
  async function approve() {
    if (!review || !canApproveOrganizer(review.item)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.approveOrganizer(
        review.item.id,
        requestKey(`approve:${review.item.id}`),
      );
      if (result.status !== "approved")
        throw new Error(t("approveNotConfirmed"));
      setNotice(
        t("approvedNotice", {
          prefix: mode === "demo" ? t("demoPrefix") : "",
          name: review.item.applicant_name,
        }),
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
    if (!review) return;
    const reason = String(
      new FormData(event.currentTarget).get("reason"),
    ).trim();
    if (reason.length < 3) {
      setError(new Error(t("reasonRequired")));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.rejectOrganizer(
        review.item.id,
        reason,
        requestKey(`reject:${review.item.id}:${reason}`),
      );
      if (result.status !== "rejected")
        throw new Error(t("rejectNotConfirmed"));
      setNotice(
        t("rejectedNotice", {
          prefix: mode === "demo" ? t("demoPrefix") : "",
          name: review.item.applicant_name,
        }),
      );
      setReview(null);
      refresh();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  function open(
    item: OrganizerApplication,
    action: "review" | "approve" | "reject",
  ) {
    setError(null);
    setReview({ item, action });
  }
  if (resource.loading) return <LoadingSpinner label={t("loading")} />;
  if (resource.error || !resource.data)
    return (
      <>
        <AdminHeader title={t("title")} description={t("errorDescription")} />
        <AdminErrorState error={resource.error} retry={resource.retry} />
      </>
    );
  const shown = resource.data.filter(
    (item) => !status || item.status === status,
  );
  return (
    <>
      <AdminHeader
        title={t("title")}
        description={t("description")}
        action={
          <Button variant="outlined" onClick={resource.retry}>
            {t("refresh")}
          </Button>
        }
      />
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
        <option value="pending">{t("status.pending")}</option>
        <option value="approved">{t("status.approved")}</option>
        <option value="rejected">{t("status.rejected")}</option>
        <option value="">{t("allApplications")}</option>
      </Select>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-label">
            <thead className="border-b border-divider bg-background text-text-secondary">
              <tr>
                {(
                  [
                    "organizer",
                    "requestedEvent",
                    "identityPayout",
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
              {shown.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-divider last:border-0"
                >
                  <td className="px-lg py-lg">
                    <p className="font-medium">{item.applicant_name}</p>
                    <p className="mt-xs text-text-secondary">{item.email}</p>
                    <p className="mt-xs text-text-secondary">
                      {t("submitted", {
                        date: dateLabel(item.created_at, locale),
                      })}
                    </p>
                  </td>
                  <td className="px-lg py-lg">
                    {item.requested_event_title ?? t("profileReview")}
                  </td>
                  <td className="px-lg py-lg">
                    {item.profile ? (
                      <>
                        <p className="capitalize">
                          {t("identity", {
                            status: verificationText(
                              item.profile.verification_status,
                            ),
                          })}
                        </p>
                        <p className="mt-xs text-text-secondary">
                          {t("payout", {
                            status: item.profile.payout_verified
                              ? t("verified")
                              : t("pending"),
                          })}
                        </p>
                      </>
                    ) : (
                      <p className="text-text-secondary">
                        {item.organization_name ?? t("noOrganization")}
                      </p>
                    )}
                  </td>
                  <td className="px-lg py-lg">
                    <Badge
                      variant={
                        item.status === "approved"
                          ? "success"
                          : item.status === "rejected"
                            ? "error"
                            : "neutral"
                      }
                      className="capitalize"
                    >
                      {statusText(item.status)}
                    </Badge>
                  </td>
                  <td className="px-lg py-md">
                    <div className="flex flex-wrap gap-sm">
                      <Button
                        variant="text"
                        className="px-sm text-label"
                        onClick={() => open(item, "review")}
                      >
                        {t("reviewDetails")}
                      </Button>
                      <Button
                        variant="outlined"
                        className="px-sm text-label"
                        disabled={!canApproveOrganizer(item)}
                        onClick={() => open(item, "approve")}
                      >
                        {t("approve")}
                      </Button>
                      <Button
                        variant="text"
                        className="px-sm text-label text-error"
                        disabled={item.status !== "pending"}
                        onClick={() => open(item, "reject")}
                      >
                        {t("reject")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && (
            <div className="space-y-sm p-xl">
              <h2 className="text-title">
                {t("emptyTitle", { status: status || "all" })}
              </h2>
              <p className="text-label text-text-secondary">{t("emptyBody")}</p>
            </div>
          )}
        </div>
      </Card>
      <p className="text-label text-text-secondary">{t("footnote")}</p>
      {review && (
        <Modal
          title={
            review.action === "reject"
              ? t("rejectModalTitle")
              : review.action === "approve"
                ? t("approveModalTitle")
                : t("detailsModalTitle")
          }
          busy={busy}
          onClose={() => {
            setReview(null);
            setError(null);
          }}
        >
          <div className="space-y-sm">
            <h3 className="text-title">{review.item.applicant_name}</h3>
            <p className="text-label text-text-secondary">
              {review.item.email}
            </p>
            <Badge className="capitalize">
              {statusText(review.item.status)}
            </Badge>
          </div>
          <dl className="grid gap-md text-label sm:grid-cols-2">
            {[
              ["organization", review.item.organization_name],
              ["contactPhone", review.item.contact_phone],
              ["identityReference", review.item.sandbox_identity_reference],
              ["maskedPayout", review.item.profile?.payout_account_masked],
              ["payoutReference", review.item.sandbox_payout_reference],
              ["requestedEvent", review.item.requested_event_title],
              ["about", review.item.description],
            ].map(([field, value]) => (
              <div key={field}>
                <dt className="text-text-secondary">{t(`fields.${field}`)}</dt>
                <dd className="mt-xs break-all">{value ?? t("notSupplied")}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-sm text-label">
            {Object.entries(approvalRequirements(review.item)).map(
              ([requirement, done]) => (
                <li key={requirement} className="flex items-start gap-sm">
                  <span
                    aria-hidden="true"
                    className={done ? "text-success" : "text-text-tertiary"}
                  >
                    {done ? "✓" : "○"}
                  </span>
                  {t("requirement", {
                    label: label(requirement),
                    state: done ? t("complete") : t("requirementPending"),
                  })}
                </li>
              ),
            )}
          </ul>
          {review.item.rejection_reason && (
            <Card className="space-y-sm">
              <p className="text-label font-medium">{t("rejectionReason")}</p>
              <p className="whitespace-pre-wrap break-words text-label">
                {review.item.rejection_reason}
              </p>
            </Card>
          )}
          {review.item.reviewed_at && (
            <p className="text-label text-text-secondary">
              {t("reviewed", {
                date: dateLabel(review.item.reviewed_at, locale),
              })}
            </p>
          )}
          {!!error && <ErrorState error={error} />}{" "}
          {review.action === "reject" ? (
            <form onSubmit={reject} className="space-y-md">
              <Textarea
                label={t("rejectionReason")}
                name="reason"
                required
                minLength={3}
                maxLength={500}
                disabled={busy}
              />
              <Button type="submit" loading={busy} className="w-full bg-error">
                {t("confirmRejection")}
              </Button>
            </form>
          ) : (
            review.item.status === "pending" && (
              <div className="space-y-md">
                {!canApproveOrganizer(review.item) && (
                  <p className="text-label text-text-secondary">
                    {t("pendingChecks")}
                  </p>
                )}
                <div className="flex flex-wrap gap-md">
                  <Button
                    disabled={!canApproveOrganizer(review.item) || busy}
                    loading={busy}
                    onClick={approve}
                  >
                    {t("confirmApproval")}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={busy}
                    onClick={() => setReview({ ...review, action: "reject" })}
                  >
                    {t("rejectApplication")}
                  </Button>
                </div>
              </div>
            )
          )}
          {review.item.requested_event_id && (
            <Link
              href={href(
                `/admin/events?event=${review.item.requested_event_id}`,
              )}
              className="inline-block text-label underline"
            >
              {t("reviewRequestedEvent")}
            </Link>
          )}
        </Modal>
      )}
    </>
  );
}
