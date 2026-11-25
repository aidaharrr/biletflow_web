"use client";
import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useIntlLocale } from "@/i18n/labels";
import { Badge, Button, Card, Input, Modal, Textarea } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AdminErrorState, AdminHeader } from "./AdminStates";
import { useAdmin, useAdminRequestKey } from "./AdminShell";
import {
  filterAdminEvents,
  isHiddenEvent,
  isSuspendedEvent,
} from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { eventDate } from "@/lib/events";
import { useApiData } from "@/hooks/useApiData";
import { cn } from "@/lib/cn";
import type { AdminEvent } from "@/types/api";
const filters = [
  ["", "all"],
  ["published", "published"],
  ["draft", "draft"],
  ["suspended", "suspended"],
] as const;
export function AdminEvents({ initialEventId }: { initialEventId: string }) {
  const t = useTranslations("admin.events");
  const locale = useIntlLocale();
  const statusText = (status: string) =>
    t.has(`status.${status}`) ? t(`status.${status}`) : status;
  const { api, mode, revision, refresh, href } = useAdmin();
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<{
    event: AdminEvent;
    action: "review" | "suspend";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const key = useAdminRequestKey();
  const load = useCallback(
    (signal: AbortSignal) => {
      void revision;
      return api.getEvents({ signal, query });
    },
    [api, revision, query],
  );
  const resource = useApiData(load);
  async function suspend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
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
      const result = await api.suspendEvent(
        selected.event.id,
        reason,
        key(`${selected.event.id}:${reason}`),
      );
      if (!result.event_hidden || !result.paid_sales_stopped)
        throw new Error(t("notConfirmed"));
      setNotice(
        t("suspendedNotice", {
          prefix: mode === "demo" ? t("demoPrefix") : "",
          title: selected.event.title,
        }),
      );
      setSelected(null);
      refresh();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  function close() {
    const partial =
      error instanceof ApiError && error.code === "EVENT_SUSPENSION_INCOMPLETE";
    setSelected(null);
    setError(null);
    if (partial) refresh();
  }
  if (resource.loading) return <LoadingSpinner label={t("loading")} />;
  if (resource.error || !resource.data)
    return (
      <>
        <AdminHeader title={t("title")} description={t("errorDescription")} />
        <AdminErrorState error={resource.error} retry={resource.retry} />
      </>
    );
  const shown = filterAdminEvents(resource.data, "", filter).filter(
    (event) => !initialEventId || event.id === initialEventId,
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
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draft.trim());
        }}
        className="grid items-end gap-md sm:grid-cols-[1fr_auto]"
      >
        <Input
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" variant="outlined">
          {t("search")}
        </Button>
      </form>
      {initialEventId && (
        <Card className="flex flex-wrap items-center justify-between gap-md">
          <p className="break-all text-label">
            {t("focused", { id: initialEventId })}
          </p>
          <Link href={href("/admin/events")} className="text-label underline">
            {t("showAll")}
          </Link>
        </Card>
      )}
      <div aria-label={t("filterLabel")} className="flex flex-wrap gap-sm">
        {filters.map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={filter === value}
            className={cn(
              "rounded-badge border border-divider bg-surface px-md py-sm text-label",
              filter === value && "border-primary bg-primary text-white",
            )}
            onClick={() => setFilter(value)}
          >
            {t(`filters.${label}`)}
          </button>
        ))}
      </div>
      {mode === "live" && resource.data.length >= 100 && (
        <p className="text-label text-text-secondary">{t("limitNotice")}</p>
      )}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-label">
            <thead className="border-b border-divider bg-background text-text-secondary">
              <tr>
                {(
                  [
                    "event",
                    "organizer",
                    "status",
                    "visibility",
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
              {shown.map((event) => {
                const suspended = isSuspendedEvent(event);
                const fullySuspended = suspended && isHiddenEvent(event);
                return (
                  <tr
                    key={event.id}
                    className="border-b border-divider last:border-0"
                  >
                    <td className="max-w-72 px-lg py-lg">
                      <p className="font-medium">{event.title}</p>
                      <p className="mt-xs text-text-secondary">
                        {eventDate(event, locale)}
                      </p>
                      <p className="mt-xs text-text-secondary">
                        {event.venue.name}
                      </p>
                    </td>
                    <td className="px-lg py-lg">{event.organizer_name}</td>
                    <td className="px-lg py-lg">
                      <Badge
                        variant={
                          suspended
                            ? "error"
                            : event.status === "published"
                              ? "success"
                              : "neutral"
                        }
                        className="capitalize"
                      >
                        {fullySuspended
                          ? t("suspendedBadge")
                          : suspended
                            ? t("salesSuspended")
                            : statusText(event.status)}
                      </Badge>
                      {suspended && !isHiddenEvent(event) && (
                        <p className="mt-sm text-label text-error">
                          {t("visibilityReview")}
                        </p>
                      )}
                    </td>
                    <td className="px-lg py-lg">
                      {isHiddenEvent(event)
                        ? t("hidden")
                        : event.visibility === "unlisted"
                          ? t("unlisted")
                          : t("public")}
                    </td>
                    <td className="px-lg py-md">
                      <div className="flex flex-wrap gap-sm">
                        <Button
                          variant="text"
                          className="px-sm text-label"
                          onClick={() => {
                            setError(null);
                            setSelected({ event, action: "review" });
                          }}
                        >
                          {t("reviewEvent")}
                        </Button>
                        <Button
                          variant="outlined"
                          className="text-label"
                          disabled={fullySuspended}
                          onClick={() => {
                            setError(null);
                            setSelected({ event, action: "suspend" });
                          }}
                        >
                          {suspended && !fullySuspended
                            ? t("completeSuspension")
                            : t("suspendEvent")}
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
              <h2 className="text-title">{t("noMatchTitle")}</h2>
              <p className="text-label text-text-secondary">
                {t("noMatchBody")}
              </p>
            </div>
          )}
        </div>
      </Card>
      <p className="text-label text-text-secondary">
        {t("suspensionFootnote")}
      </p>
      {selected && (
        <Modal
          title={
            selected.action === "suspend"
              ? t("suspendModalTitle")
              : t("detailsModalTitle")
          }
          busy={busy}
          onClose={close}
        >
          <h3 className="text-title">{selected.event.title}</h3>
          <dl className="space-y-md text-label">
            <div>
              <dt className="text-text-secondary">{t("organizer")}</dt>
              <dd className="mt-xs">{selected.event.organizer_name}</dd>
            </div>
            <div>
              <dt className="text-text-secondary">{t("dateVenue")}</dt>
              <dd className="mt-xs">
                {eventDate(selected.event, locale)} ·{" "}
                {selected.event.venue.name}, {selected.event.venue.address}
              </dd>
            </div>
            <div>
              <dt className="text-text-secondary">{t("eventId")}</dt>
              <dd className="mt-xs break-all">{selected.event.id}</dd>
            </div>
          </dl>
          {selected.event.suspension_reason && (
            <Card className="space-y-sm">
              <p className="font-medium">{t("suspensionReason")}</p>
              <p className="whitespace-pre-wrap break-words text-label">
                {selected.event.suspension_reason}
              </p>
            </Card>
          )}
          {!!error && <ErrorState error={error} />}{" "}
          {selected.action === "suspend" ? (
            <form onSubmit={suspend} className="space-y-md">
              <p className="text-label text-text-secondary">
                {t("suspendHelp")}
              </p>
              <Textarea
                label={t("reasonLabel")}
                name="reason"
                required
                minLength={3}
                maxLength={500}
                disabled={busy}
              />
              {mode === "live" && (
                <p className="text-label text-text-secondary">
                  {t("liveReasonNotice")}
                </p>
              )}
              <Button type="submit" loading={busy} className="w-full bg-error">
                {t("confirm")}
              </Button>
            </form>
          ) : (
            !(
              isSuspendedEvent(selected.event) && isHiddenEvent(selected.event)
            ) && (
              <Button
                variant="outlined"
                onClick={() => setSelected({ ...selected, action: "suspend" })}
              >
                {t("suspendEvent")}
              </Button>
            )
          )}
        </Modal>
      )}
    </>
  );
}
