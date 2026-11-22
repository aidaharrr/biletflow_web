"use client";
import { useCallback, useState, type FormEvent } from "react";
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
import type { PaidEventApplication, PaidReviewStatus } from "@/types/api";

const STATUS_LABEL: Record<PaidReviewStatus, string> = {
  not_submitted: "Not submitted",
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  changes_required: "Changes required",
};

function canDecide(item: PaidEventApplication) {
  return item.status === "pending_review" && item.event.status === "draft";
}

function requirements(item: PaidEventApplication) {
  return {
    "Sandbox identity verified":
      item.profile?.verification_status === "verified",
    "Sandbox payout connected": !!item.profile?.payout_verified,
    "Activation fee recorded": item.activation_fee_paid,
    "Paid-event terms accepted": item.terms_accepted,
  };
}

export default function AdminPaidEvents() {
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
      if (result.status !== expected)
        throw new Error("The decision was not confirmed by the backend.");
      setNotice(
        decision === "approve"
          ? `“${review.item.event.title}” is approved. The organizer can now publish it and sell paid tickets.`
          : `“${review.item.event.title}” was rejected and the reason was sent to the organizer.`,
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
      setError(new Error("Enter a rejection reason."));
      return;
    }
    await decide("reject", reason);
  }

  const header = (
    <AdminHeader
      title="Paid event reviews"
      description="Approve or reject paid events before organizers can publish them and sell paid tickets. All payments are simulated."
      action={
        <Button variant="outlined" onClick={resource.retry}>
          Refresh reviews
        </Button>
      }
    />
  );
  if (mode === "demo")
    return (
      <>
        {header}
        <Card className="space-y-sm">
          <h2 className="text-title">Live mode only</h2>
          <p className="text-label text-text-secondary">
            Paid event reviews are read from the backend. Switch to live mode to
            review submitted events.
          </p>
        </Card>
      </>
    );
  if (resource.loading)
    return <LoadingSpinner label="Loading paid event reviews…" />;
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
        label="Review status"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="pending_review">Pending review</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="changes_required">Changes required</option>
        <option value="">All reviews</option>
      </Select>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-label">
            <thead className="border-b border-divider bg-background text-text-secondary">
              <tr>
                {["Event", "Organizer", "Checklist", "Status", "Actions"].map(
                  (label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-lg py-md font-medium"
                    >
                      {label}
                    </th>
                  ),
                )}
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
                        Starts {dateLabel(item.event.starts_at)}
                      </p>
                      <p className="mt-xs text-text-secondary">
                        Submitted {dateLabel(item.submitted_at)}
                      </p>
                    </td>
                    <td className="px-lg py-lg">
                      <p>{item.profile?.contact_name ?? "No profile"}</p>
                      <p className="mt-xs text-text-secondary">
                        {item.profile?.organization_name ?? ""}
                      </p>
                    </td>
                    <td className="px-lg py-lg">
                      {checks.filter(Boolean).length}/{checks.length} complete
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
                        {STATUS_LABEL[item.status] ?? item.status}
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
                          {canDecide(item) ? "Review" : "Details"}
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
              <h2 className="text-title">No matching paid event reviews</h2>
              <p className="text-label text-text-secondary">
                Organizers appear here after submitting a paid event for review.
                Use the status filter to see past decisions.
              </p>
            </div>
          )}
        </div>
      </Card>
      {review && (
        <Modal
          title={
            review.action === "reject"
              ? "Reject paid event"
              : "Paid event review"
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
              Starts {dateLabel(review.item.event.starts_at)} · event{" "}
              {review.item.event.status}
            </p>
            <Badge>
              {STATUS_LABEL[review.item.status] ?? review.item.status}
            </Badge>
          </div>
          <dl className="grid gap-md text-label sm:grid-cols-2">
            {[
              ["Contact", review.item.profile?.contact_name],
              ["Organization", review.item.profile?.organization_name],
              ["Contact phone", review.item.profile?.contact_phone],
              ["Payout account", review.item.profile?.payout_account_masked],
              ["Refund policy", review.item.event.refund_policy],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-text-secondary">{label}</dt>
                <dd className="mt-xs break-words">{value || "Not supplied"}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-sm text-label">
            {Object.entries(requirements(review.item)).map(([label, done]) => (
              <li key={label} className="flex items-start gap-sm">
                <span
                  aria-hidden="true"
                  className={done ? "text-success" : "text-text-tertiary"}
                >
                  {done ? "✓" : "○"}
                </span>
                {label}: {done ? "Complete" : "Pending"}
              </li>
            ))}
          </ul>
          {review.item.reason && (
            <Card className="space-y-sm">
              <p className="text-label font-medium">Review note</p>
              <p className="whitespace-pre-wrap break-words text-label">
                {review.item.reason}
              </p>
            </Card>
          )}
          {!!error && <ErrorState error={error} />}
          {review.action === "reject" ? (
            <form onSubmit={reject} className="space-y-md">
              <Textarea
                label="Rejection reason (sent to the organizer)"
                name="reason"
                required
                minLength={3}
                maxLength={2000}
                disabled={busy}
              />
              <Button type="submit" loading={busy} className="w-full bg-error">
                Confirm rejection
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
                  Approve paid event
                </Button>
                <Button
                  variant="outlined"
                  disabled={busy}
                  onClick={() => setReview({ ...review, action: "reject" })}
                >
                  Reject
                </Button>
              </div>
            )
          )}
        </Modal>
      )}
    </>
  );
}
