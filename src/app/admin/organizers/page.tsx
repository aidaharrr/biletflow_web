"use client";
import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
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
        throw new Error("The approval was not confirmed.");
      setNotice(
        `${mode === "demo" ? "Demo: " : ""}${review.item.applicant_name}’s application was approved.`,
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
      setError(new Error("Enter a rejection reason."));
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
        throw new Error("The rejection was not confirmed.");
      setNotice(
        `${mode === "demo" ? "Demo: " : ""}${review.item.applicant_name}’s application was rejected and the reason was recorded.`,
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
  if (resource.loading)
    return <LoadingSpinner label="Loading organizer applications…" />;
  if (resource.error || !resource.data)
    return (
      <>
        <AdminHeader
          title="Organizer applications"
          description="Review sandbox identity and payout readiness for paid-sales applications."
        />
        <AdminErrorState error={resource.error} retry={resource.retry} />
      </>
    );
  const shown = resource.data.filter(
    (item) => !status || item.status === status,
  );
  return (
    <>
      <AdminHeader
        title="Organizer applications"
        description="Review sandbox identity, payout readiness, and paid-sales application decisions."
        action={
          <Button variant="outlined" onClick={resource.retry}>
            Refresh applications
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
        label="Application status"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="">All applications</option>
      </Select>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-label">
            <thead className="border-b border-divider bg-background text-text-secondary">
              <tr>
                {[
                  "Organizer / Contact",
                  "Requested event",
                  "Identity / Payout",
                  "Status",
                  "Actions",
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="px-lg py-md font-medium"
                  >
                    {label}
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
                      Submitted {dateLabel(item.created_at)}
                    </p>
                  </td>
                  <td className="px-lg py-lg">
                    {item.requested_event_title ?? "Organizer profile review"}
                  </td>
                  <td className="px-lg py-lg">
                    <p className="capitalize">
                      Identity:{" "}
                      {item.profile.verification_status.replace(/_/g, " ")}
                    </p>
                    <p className="mt-xs text-text-secondary">
                      Payout:{" "}
                      {item.profile.payout_verified ? "Verified" : "Pending"}
                    </p>
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
                      {item.status}
                    </Badge>
                  </td>
                  <td className="px-lg py-md">
                    <div className="flex flex-wrap gap-sm">
                      <Button
                        variant="text"
                        className="px-sm text-label"
                        onClick={() => open(item, "review")}
                      >
                        Review details
                      </Button>
                      <Button
                        variant="outlined"
                        className="px-sm text-label"
                        disabled={!canApproveOrganizer(item)}
                        onClick={() => open(item, "approve")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="text"
                        className="px-sm text-label text-error"
                        disabled={item.status !== "pending"}
                        onClick={() => open(item, "reject")}
                      >
                        Reject
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
                No {status || "matching"} applications
              </h2>
              <p className="text-label text-text-secondary">
                Reviewed decisions remain available in the status filter.
              </p>
            </div>
          )}
        </div>
      </Card>
      <p className="text-label text-text-secondary">
        Approval requires verified sandbox identity and payout details, accepted
        terms, and a simulated activation fee. Each event retains its own
        paid-sales activation checklist.
      </p>
      {review && (
        <Modal
          title={
            review.action === "reject"
              ? "Reject organizer application"
              : review.action === "approve"
                ? "Approve organizer application"
                : "Organizer application details"
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
            <Badge className="capitalize">{review.item.status}</Badge>
          </div>
          <dl className="grid gap-md text-label sm:grid-cols-2">
            {[
              ["Organization", review.item.organization_name],
              ["Contact phone", review.item.contact_phone],
              [
                "Sandbox identity reference",
                review.item.sandbox_identity_reference,
              ],
              [
                "Masked payout account",
                review.item.profile.payout_account_masked,
              ],
              [
                "Sandbox payout reference",
                review.item.sandbox_payout_reference,
              ],
              ["Requested event", review.item.requested_event_title],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-text-secondary">{label}</dt>
                <dd className="mt-xs break-all">{value ?? "Not supplied"}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-sm text-label">
            {Object.entries(approvalRequirements(review.item)).map(
              ([label, done]) => (
                <li key={label} className="flex items-start gap-sm">
                  <span
                    aria-hidden="true"
                    className={done ? "text-success" : "text-text-tertiary"}
                  >
                    {done ? "✓" : "○"}
                  </span>
                  {label}: {done ? "Complete" : "Pending"}
                </li>
              ),
            )}
          </ul>
          {review.item.rejection_reason && (
            <Card className="space-y-sm">
              <p className="text-label font-medium">Rejection reason</p>
              <p className="whitespace-pre-wrap break-words text-label">
                {review.item.rejection_reason}
              </p>
            </Card>
          )}
          {review.item.reviewed_at && (
            <p className="text-label text-text-secondary">
              Reviewed {dateLabel(review.item.reviewed_at)}
            </p>
          )}
          {!!error && <ErrorState error={error} />}{" "}
          {review.action === "reject" ? (
            <form onSubmit={reject} className="space-y-md">
              <Textarea
                label="Rejection reason"
                name="reason"
                required
                minLength={3}
                maxLength={500}
                disabled={busy}
              />
              <Button type="submit" loading={busy} className="w-full bg-error">
                Confirm rejection
              </Button>
            </form>
          ) : (
            review.item.status === "pending" && (
              <div className="space-y-md">
                {!canApproveOrganizer(review.item) && (
                  <p className="text-label text-text-secondary">
                    Complete the pending sandbox checks before this application
                    can be approved.
                  </p>
                )}
                <div className="flex flex-wrap gap-md">
                  <Button
                    disabled={!canApproveOrganizer(review.item) || busy}
                    loading={busy}
                    onClick={approve}
                  >
                    Confirm approval
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={busy}
                    onClick={() => setReview({ ...review, action: "reject" })}
                  >
                    Reject application
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
              Review requested event →
            </Link>
          )}
        </Modal>
      )}
    </>
  );
}
