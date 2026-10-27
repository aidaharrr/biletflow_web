"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Badge, Button, Card, Modal, StatCard } from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAdmin } from "@/components/admin/AdminShell";
import { AdminErrorState, AdminHeader } from "@/components/admin/AdminStates";
import { useApiData } from "@/hooks/useApiData";
import { dateLabel } from "@/lib/organizer";
import type { AdminSupportCase } from "@/types/api";
export default function AdminDashboard() {
  const { api, mode, revision, href } = useAdmin();
  const [selected, setSelected] = useState<AdminSupportCase | null>(null);
  const load = useCallback(
    (signal: AbortSignal) => {
      void revision;
      return api.getDashboard({ signal });
    },
    [api, revision],
  );
  const resource = useApiData(load);
  if (resource.loading)
    return <LoadingSpinner label="Loading platform metrics…" />;
  if (resource.error || !resource.data)
    return <AdminErrorState error={resource.error} retry={resource.retry} />;
  const data = resource.data;
  return (
    <>
      <AdminHeader
        title="Platform overview"
        description="Platform-wide account totals, event activity, and moderation queues."
        action={
          <Button variant="outlined" onClick={resource.retry}>
            Refresh metrics
          </Button>
        }
      />
      <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Registered Users"
          value={data.total_registered_users ?? "—"}
          helper="All platform accounts, including suspended"
          accent
        />
        <StatCard
          label="Active Events"
          value={data.active_events ?? "—"}
          helper="Published, visible events that have not ended"
        />
        <StatCard
          label="Pending Organizer Applications"
          value={data.pending_organizer_applications ?? "—"}
          helper="Awaiting a platform review decision"
        />
        <StatCard
          label="Escalated Support Cases"
          value={data.escalated_support_cases ?? "—"}
          helper="Escalated cases that are not resolved"
        />
      </div>
      <p className="text-label text-text-secondary">
        {mode === "demo" ? "Example report snapshot" : "Metrics checked"}:{" "}
        {dateLabel(data.as_of)} · UTC+05:00
      </p>
      {data.issues.length > 0 && (
        <Card className="space-y-md">
          <h2 className="text-title">Some metrics are unavailable</h2>
          <ul className="space-y-sm text-label text-text-secondary">
            {data.issues.map((issue) => (
              <li key={issue.metric}>
                <strong className="font-medium text-text-primary">
                  {issue.metric}:{" "}
                </strong>
                {issue.message}
              </li>
            ))}
          </ul>
          <Link
            href="/admin/dashboard?mode=demo"
            className="inline-block font-medium underline"
          >
            View the complete demo report
          </Link>
        </Card>
      )}
      <section className="space-y-lg">
        <h2 className="text-title">Moderation queues</h2>
        <div className="grid gap-lg sm:grid-cols-2">
          {[
            [
              "/admin/organizers",
              "Review organizer applications",
              "Inspect sandbox identity, payout readiness, and application decisions.",
            ],
            [
              "/admin/events",
              "Moderate platform events",
              "Review published events, drafts, and suspended listings.",
            ],
            [
              "/admin/users",
              "Manage user access",
              "Inspect roles and review account or session restrictions.",
            ],
            [
              "/admin/dashboard#support-queue",
              "Review escalated support",
              "Inspect cases requiring platform-level attention.",
            ],
          ].map(([target, title, description]) => (
            <Link
              href={href(target)}
              key={target}
              className="rounded-card focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Card className="h-full space-y-md transition-shadow hover:shadow-lg">
                <h3 className="font-medium">{title} →</h3>
                <p className="text-label text-text-secondary">{description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
      <section id="support-queue" className="scroll-mt-lg space-y-lg">
        <h2 className="text-title">Escalated support queue</h2>
        <Card className="overflow-hidden p-0">
          {data.escalated_cases === null ? (
            <div className="space-y-md p-lg">
              <p className="text-label text-text-secondary">
                The live escalation queue is not available. Cases are not
                inferred from ordinary support statuses.
              </p>
              <Link
                href="/admin/dashboard?mode=demo#support-queue"
                className="inline-block font-medium underline"
              >
                Preview sample escalations
              </Link>
            </div>
          ) : data.escalated_cases.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-label">
                <thead className="border-b border-divider bg-background text-text-secondary">
                  <tr>
                    {["Case", "Requester", "Status", "Updated", "Review"].map(
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
                  {data.escalated_cases.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-divider last:border-0"
                    >
                      <td className="px-lg py-md">
                        <p className="font-medium">{item.subject}</p>
                        <p className="mt-xs capitalize text-text-secondary">
                          {item.category.replace(/_/g, " ")}
                        </p>
                      </td>
                      <td className="px-lg py-md">
                        {item.requester_name ?? item.requester_id.slice(0, 8)}
                      </td>
                      <td className="px-lg py-md">
                        <Badge className="capitalize">
                          {item.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-lg py-md">
                        {dateLabel(item.updated_at)}
                      </td>
                      <td className="px-lg py-md">
                        <Button
                          variant="outlined"
                          className="text-label"
                          onClick={() => setSelected(item)}
                        >
                          Review case
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-lg text-label text-text-secondary">
              No unresolved escalated support cases.
            </p>
          )}
        </Card>
      </section>
      {selected && (
        <Modal title="Escalated support case" onClose={() => setSelected(null)}>
          <h3 className="text-title">{selected.subject}</h3>
          <Badge className="capitalize">
            {selected.status.replace(/_/g, " ")}
          </Badge>
          <p className="text-label text-text-secondary">
            {selected.escalation_reason ?? "Platform review requested."}
          </p>
          <dl className="space-y-md text-label">
            {[
              ["Case ID", selected.id],
              ["Requester", selected.requester_name ?? selected.requester_id],
              ["Event ID", selected.event_id],
              ["Order ID", selected.order_id],
              ["Ticket ID", selected.ticket_id],
            ].map(
              ([label, value]) =>
                value && (
                  <div key={label}>
                    <dt className="text-text-secondary">{label}</dt>
                    <dd className="mt-xs break-all">{value}</dd>
                  </div>
                ),
            )}
          </dl>
          {selected.event_id && (
            <Link
              href={href(
                `/admin/events?event=${encodeURIComponent(selected.event_id)}`,
              )}
              className="inline-block font-medium underline"
            >
              Review contextual event →
            </Link>
          )}
        </Modal>
      )}
    </>
  );
}
