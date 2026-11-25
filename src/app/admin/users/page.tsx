"use client";
import { useCallback, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useIntlLocale, useLabel } from "@/i18n/labels";
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AdminErrorState, AdminHeader } from "@/components/admin/AdminStates";
import { useAdmin, useAdminRequestKey } from "@/components/admin/AdminShell";
import { filterAdminUsers, roleLabel } from "@/lib/admin";
import { dateLabel } from "@/lib/organizer";
import { useApiData } from "@/hooks/useApiData";
import type { AdminUser } from "@/types/api";
export default function AdminUsers() {
  const t = useTranslations("admin.users");
  const label = useLabel();
  const locale = useIntlLocale();
  const { api, mode, viewer, revision, refresh } = useAdmin();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<{
    user: AdminUser;
    action: "review" | "suspend" | "revoke";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const key = useAdminRequestKey();
  const load = useCallback(
    (signal: AbortSignal) => {
      void revision;
      return api.getUsers({ signal, query });
    },
    [api, query, revision],
  );
  const resource = useApiData(load);
  function open(user: AdminUser, action: "review" | "suspend" | "revoke") {
    setError(null);
    setSelected({ user, action });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !selected ||
      selected.action === "review" ||
      selected.user.id === viewer.id
    )
      return;
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
      if (selected.action === "suspend") {
        const result = await api.suspendUser(
          selected.user.id,
          reason,
          key(`suspend:${selected.user.id}:${reason}`),
        );
        if (result.status !== "suspended")
          throw new Error(t("suspendNotConfirmed"));
        setNotice(
          t("suspendedNotice", {
            prefix: mode === "demo" ? t("demoPrefix") : "",
            email: selected.user.email,
          }),
        );
      } else {
        const result = await api.revokeUserAccess(
          selected.user.id,
          reason,
          key(`revoke:${selected.user.id}:${reason}`),
        );
        if (result.status !== "revoked")
          throw new Error(t("revokeNotConfirmed"));
        setNotice(
          t("revokedNotice", {
            prefix: mode === "demo" ? t("demoPrefix") : "",
            count: result.revoked_sessions,
            email: selected.user.email,
          }),
        );
      }
      setSelected(null);
      refresh();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  if (resource.loading) return <LoadingSpinner label={t("loading")} />;
  if (resource.error || !resource.data)
    return (
      <>
        <AdminHeader title={t("title")} description={t("errorDescription")} />
        <AdminErrorState error={resource.error} retry={resource.retry} />
      </>
    );
  const shown = filterAdminUsers(resource.data, "", status);
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
        className="grid items-end gap-md sm:grid-cols-[1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draft.trim());
        }}
      >
        <Input
          label={t("searchLabel")}
          placeholder="name@example.com"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          helperText={
            mode === "demo" ? t("demoSearchHelp") : t("liveSearchHelp")
          }
        />
        <Button type="submit" variant="outlined">
          {t("search")}
        </Button>
      </form>
      <Select
        label={t("statusLabel")}
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="">{t("allAccounts")}</option>
        <option value="active">{t("active")}</option>
        <option value="suspended">{t("suspended")}</option>
      </Select>
      {mode === "live" && resource.data.length >= 100 && (
        <p className="text-label text-text-secondary">{t("limitNotice")}</p>
      )}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-label">
            <thead className="border-b border-divider bg-background text-text-secondary">
              <tr>
                {(["user", "roles", "account", "actions"] as const).map(
                  (column) => (
                    <th
                      key={column}
                      scope="col"
                      className="px-lg py-md font-medium"
                    >
                      {t(`columns.${column}`)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-divider last:border-0"
                >
                  <td className="px-lg py-lg">
                    <p className="font-medium">
                      {user.full_name ?? t("unnamed")}
                      {user.id === viewer.id ? t("you") : ""}
                    </p>
                    <p className="mt-xs text-text-secondary">{user.email}</p>
                  </td>
                  <td className="px-lg py-lg">
                    <div className="flex flex-wrap gap-sm">
                      {user.roles.map((role) => (
                        <Badge key={role}>{label(roleLabel(role))}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-lg py-lg">
                    <Badge variant={user.is_active ? "success" : "error"}>
                      {user.is_active ? t("active") : t("suspended")}
                    </Badge>
                    {user.last_access_revoked_at && (
                      <p className="mt-sm text-text-secondary">
                        {t("sessionsRevoked", {
                          date: dateLabel(user.last_access_revoked_at, locale),
                        })}
                      </p>
                    )}
                  </td>
                  <td className="px-lg py-md">
                    <div className="flex flex-wrap gap-sm">
                      <Button
                        variant="text"
                        className="px-sm text-label"
                        onClick={() => open(user, "review")}
                      >
                        {t("viewUser")}
                      </Button>
                      <Button
                        variant="outlined"
                        className="text-label"
                        disabled={user.id === viewer.id || !user.is_active}
                        onClick={() => open(user, "revoke")}
                      >
                        {t("revokeAccess")}
                      </Button>
                      <Button
                        variant="text"
                        className="px-sm text-label text-error"
                        disabled={user.id === viewer.id || !user.is_active}
                        onClick={() => open(user, "suspend")}
                      >
                        {t("suspendAccount")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
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
      <p className="text-label text-text-secondary">{t("footnote")}</p>
      {selected && (
        <Modal
          title={
            selected.action === "review"
              ? t("detailsModalTitle")
              : selected.action === "revoke"
                ? t("revokeModalTitle")
                : t("suspendModalTitle")
          }
          busy={busy}
          onClose={() => {
            setSelected(null);
            setError(null);
          }}
        >
          <div className="space-y-sm">
            <h3 className="text-title">
              {selected.user.full_name ?? t("userAccount")}
            </h3>
            <p className="break-all text-label text-text-secondary">
              {selected.user.email}
            </p>
            <div className="flex flex-wrap gap-sm">
              {selected.user.roles.map((role) => (
                <Badge key={role}>{label(roleLabel(role))}</Badge>
              ))}
            </div>
          </div>
          {!!error && <ErrorState error={error} />}{" "}
          {selected.action === "review" ? (
            <>
              <dl className="space-y-md text-label">
                <div>
                  <dt className="text-text-secondary">{t("accountStatus")}</dt>
                  <dd className="mt-xs">
                    {selected.user.is_active ? t("active") : t("suspended")}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary">
                    {t("emailVerification")}
                  </dt>
                  <dd className="mt-xs">
                    {selected.user.email_verified
                      ? t("verified")
                      : t("notVerified")}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary">{t("userId")}</dt>
                  <dd className="mt-xs break-all">{selected.user.id}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">{t("activeSessions")}</dt>
                  <dd className="mt-xs">
                    {selected.user.active_sessions ?? t("unavailable")}
                  </dd>
                </div>
                {selected.user.created_at && (
                  <div>
                    <dt className="text-text-secondary">{t("registered")}</dt>
                    <dd className="mt-xs">
                      {dateLabel(selected.user.created_at, locale)}
                    </dd>
                  </div>
                )}
                {selected.user.suspension_reason && (
                  <div>
                    <dt className="text-text-secondary">
                      {t("suspensionReason")}
                    </dt>
                    <dd className="mt-xs whitespace-pre-wrap break-words">
                      {selected.user.suspension_reason}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-wrap gap-md">
                <Button
                  variant="outlined"
                  disabled={
                    selected.user.id === viewer.id || !selected.user.is_active
                  }
                  onClick={() => open(selected.user, "revoke")}
                >
                  {t("revokeAccess")}
                </Button>
                <Button
                  variant="text"
                  disabled={
                    selected.user.id === viewer.id || !selected.user.is_active
                  }
                  onClick={() => open(selected.user, "suspend")}
                >
                  {t("suspendAccount")}
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-md">
              <p className="text-label text-text-secondary">
                {selected.action === "revoke"
                  ? t("revokeHelp")
                  : t("suspendHelp")}
              </p>
              <Textarea
                label={
                  selected.action === "revoke"
                    ? t("revokeReasonLabel")
                    : t("suspendReasonLabel")
                }
                name="reason"
                required
                minLength={3}
                maxLength={500}
                disabled={busy}
              />
              {mode === "live" && (
                <p className="text-label text-text-secondary">
                  {selected.action === "revoke"
                    ? t("liveRevokeNotice")
                    : t("liveSuspendNotice")}
                </p>
              )}
              <Button type="submit" loading={busy} className="w-full bg-error">
                {selected.action === "revoke"
                  ? t("confirmRevoke")
                  : t("confirmSuspend")}
              </Button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
