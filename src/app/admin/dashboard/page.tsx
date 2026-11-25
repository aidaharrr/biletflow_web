"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorText, useIntlLocale, useLabel } from "@/i18n/labels";
import { Badge, Button, Card, Modal, StatCard } from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAdmin } from "@/components/admin/AdminShell";
import { EmailDiagnosticsCard } from "@/components/admin/EmailDiagnostics";
import { AdminErrorState, AdminHeader } from "@/components/admin/AdminStates";
import { useApiData } from "@/hooks/useApiData";
import { dateLabel } from "@/lib/organizer";
import type { AdminSupportCase } from "@/types/api";
export default function AdminDashboard() {
  const t = useTranslations("admin.dashboard");
  const tAdmin = useTranslations("admin");
  const label = useLabel();
  const errorText = useErrorText();
  const locale = useIntlLocale();
  const enumText = (group: "status" | "category", value: string) =>
    tAdmin.has(`${group}.${value}`)
      ? tAdmin(`${group}.${value}`)
      : value.replace(/_/g, " ");
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
  if (resource.loading) return <LoadingSpinner label={t("loading")} />;
  if (resource.error || !resource.data)
    return <AdminErrorState error={resource.error} retry={resource.retry} />;
  const data = resource.data;
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
      <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("totalUsers")}
          value={data.total_registered_users ?? "—"}
          helper={t("totalUsersHelper")}
          accent
        />
        <StatCard
          label={t("activeEvents")}
          value={data.active_events ?? "—"}
          helper={t("activeEventsHelper")}
        />
        <StatCard
          label={t("pendingApplications")}
          value={data.pending_organizer_applications ?? "—"}
          helper={t("pendingApplicationsHelper")}
        />
        <StatCard
          label={t("escalatedCases")}
          value={data.escalated_support_cases ?? "—"}
          helper={t("escalatedCasesHelper")}
        />
      </div>
      <p className="text-label text-text-secondary">
        {mode === "demo" ? t("demoSnapshot") : t("metricsChecked")}:{" "}
        {dateLabel(data.as_of, locale)} · UTC+05:00
      </p>
      {data.issues.length > 0 && (
        <Card className="space-y-md">
          <h2 className="text-title">{t("metricsUnavailable")}</h2>
          <ul className="space-y-sm text-label text-text-secondary">
            {data.issues.map((issue) => (
              <li key={issue.metric}>
                <strong className="font-medium text-text-primary">
                  {label(issue.metric)}:{" "}
                </strong>
                {errorText(issue.message)}
              </li>
            ))}
          </ul>
          <Link
            href="/admin/dashboard?mode=demo"
            className="inline-block font-medium underline"
          >
            {t("viewDemoReport")}
          </Link>
        </Card>
      )}
      <section className="space-y-lg">
        <h2 className="text-title">{t("queuesTitle")}</h2>
        <div className="grid gap-lg sm:grid-cols-2">
          {[
            [
              "/admin/organizers",
              t("queues.organizersTitle"),
              t("queues.organizersDescription"),
            ],
            [
              "/admin/events",
              t("queues.eventsTitle"),
              t("queues.eventsDescription"),
            ],
            [
              "/admin/users",
              t("queues.usersTitle"),
              t("queues.usersDescription"),
            ],
            [
              "/admin/dashboard#support-queue",
              t("queues.supportTitle"),
              t("queues.supportDescription"),
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
        <h2 className="text-title">{t("supportQueueTitle")}</h2>
        <Card className="overflow-hidden p-0">
          {data.escalated_cases === null ? (
            <div className="space-y-md p-lg">
              <p className="text-label text-text-secondary">
                {t("liveQueueUnavailable")}
              </p>
              <Link
                href="/admin/dashboard?mode=demo#support-queue"
                className="inline-block font-medium underline"
              >
                {t("previewEscalations")}
              </Link>
            </div>
          ) : data.escalated_cases.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-label">
                <thead className="border-b border-divider bg-background text-text-secondary">
                  <tr>
                    {(
                      [
                        "case",
                        "requester",
                        "status",
                        "updated",
                        "review",
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
                  {data.escalated_cases.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-divider last:border-0"
                    >
                      <td className="px-lg py-md">
                        <p className="font-medium">{item.subject}</p>
                        <p className="mt-xs capitalize text-text-secondary">
                          {enumText("category", item.category)}
                        </p>
                      </td>
                      <td className="px-lg py-md">
                        {item.requester_name ?? item.requester_id.slice(0, 8)}
                      </td>
                      <td className="px-lg py-md">
                        <Badge className="capitalize">
                          {enumText("status", item.status)}
                        </Badge>
                      </td>
                      <td className="px-lg py-md">
                        {dateLabel(item.updated_at, locale)}
                      </td>
                      <td className="px-lg py-md">
                        <Button
                          variant="outlined"
                          className="text-label"
                          onClick={() => setSelected(item)}
                        >
                          {t("reviewCase")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-lg text-label text-text-secondary">
              {t("noCases")}
            </p>
          )}
        </Card>
      </section>
      {selected && (
        <Modal title={t("caseModalTitle")} onClose={() => setSelected(null)}>
          <h3 className="text-title">{selected.subject}</h3>
          <Badge className="capitalize">
            {enumText("status", selected.status)}
          </Badge>
          <p className="text-label text-text-secondary">
            {selected.escalation_reason ?? t("defaultEscalationReason")}
          </p>
          <dl className="space-y-md text-label">
            {[
              [t("caseId"), selected.id],
              [
                t("requester"),
                selected.requester_name ?? selected.requester_id,
              ],
              [t("eventId"), selected.event_id],
              [t("orderId"), selected.order_id],
              [t("ticketId"), selected.ticket_id],
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
              {t("reviewEvent")}
            </Link>
          )}
        </Modal>
      )}
      {mode === "live" && <EmailDiagnosticsCard />}
    </>
  );
}
