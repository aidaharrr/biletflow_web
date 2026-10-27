"use client";
import { useCallback, useState, type FormEvent } from "react";
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
      setError(new Error("Enter a restriction reason."));
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
          throw new Error("The suspension was not confirmed.");
        setNotice(
          `${mode === "demo" ? "Demo: " : ""}${selected.user.email} was suspended. Requests from this account are denied.`,
        );
      } else {
        const result = await api.revokeUserAccess(
          selected.user.id,
          reason,
          key(`revoke:${selected.user.id}:${reason}`),
        );
        if (result.status !== "revoked")
          throw new Error("Session revocation was not confirmed.");
        setNotice(
          `${mode === "demo" ? "Demo: " : ""}${result.revoked_sessions} active session(s) revoked for ${selected.user.email}. The account may sign in again.`,
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
  if (resource.loading)
    return <LoadingSpinner label="Loading user directory…" />;
  if (resource.error || !resource.data)
    return (
      <>
        <AdminHeader
          title="User management"
          description="Inspect account roles and control platform access."
        />
        <AdminErrorState error={resource.error} retry={resource.retry} />
      </>
    );
  const shown = filterAdminUsers(resource.data, "", status);
  return (
    <>
      <AdminHeader
        title="User management"
        description="Inspect roles, revoke sessions, or suspend accounts."
        action={
          <Button variant="outlined" onClick={resource.retry}>
            Refresh users
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
          label="Search users by email"
          placeholder="name@example.com"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          helperText={
            mode === "demo"
              ? "Sample records also support name search."
              : "Search uses the live directory’s email filter."
          }
        />
        <Button type="submit" variant="outlined">
          Search users
        </Button>
      </form>
      <Select
        label="Account status"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        <option value="">All accounts</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </Select>
      {mode === "live" && resource.data.length >= 100 && (
        <p className="text-label text-text-secondary">
          Directory results are limited to 100 records. Enter an email address
          to narrow the search beyond this list.
        </p>
      )}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-label">
            <thead className="border-b border-divider bg-background text-text-secondary">
              <tr>
                {["User", "Roles", "Account", "Actions"].map((label) => (
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
              {shown.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-divider last:border-0"
                >
                  <td className="px-lg py-lg">
                    <p className="font-medium">
                      {user.full_name ?? "Unnamed user"}
                      {user.id === viewer.id ? " (you)" : ""}
                    </p>
                    <p className="mt-xs text-text-secondary">{user.email}</p>
                  </td>
                  <td className="px-lg py-lg">
                    <div className="flex flex-wrap gap-sm">
                      {user.roles.map((role) => (
                        <Badge key={role}>{roleLabel(role)}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-lg py-lg">
                    <Badge variant={user.is_active ? "success" : "error"}>
                      {user.is_active ? "Active" : "Suspended"}
                    </Badge>
                    {user.last_access_revoked_at && (
                      <p className="mt-sm text-text-secondary">
                        Sessions revoked{" "}
                        {dateLabel(user.last_access_revoked_at)}
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
                        View user
                      </Button>
                      <Button
                        variant="outlined"
                        className="text-label"
                        disabled={user.id === viewer.id || !user.is_active}
                        onClick={() => open(user, "revoke")}
                      >
                        Revoke access
                      </Button>
                      <Button
                        variant="text"
                        className="px-sm text-label text-error"
                        disabled={user.id === viewer.id || !user.is_active}
                        onClick={() => open(user, "suspend")}
                      >
                        Suspend account
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && (
            <div className="space-y-sm p-xl">
              <h2 className="text-title">No matching users</h2>
              <p className="text-label text-text-secondary">
                Try another email or account status.
              </p>
            </div>
          )}
        </div>
      </Card>
      <p className="text-label text-text-secondary">
        Revoke access ends active sessions while allowing a later sign-in.
        Suspension blocks authenticated requests. You cannot restrict your own
        Admin account.
      </p>
      {selected && (
        <Modal
          title={
            selected.action === "review"
              ? "User account details"
              : selected.action === "revoke"
                ? "Revoke user access?"
                : "Suspend this account?"
          }
          busy={busy}
          onClose={() => {
            setSelected(null);
            setError(null);
          }}
        >
          <div className="space-y-sm">
            <h3 className="text-title">
              {selected.user.full_name ?? "User account"}
            </h3>
            <p className="break-all text-label text-text-secondary">
              {selected.user.email}
            </p>
            <div className="flex flex-wrap gap-sm">
              {selected.user.roles.map((role) => (
                <Badge key={role}>{roleLabel(role)}</Badge>
              ))}
            </div>
          </div>
          {!!error && <ErrorState error={error} />}{" "}
          {selected.action === "review" ? (
            <>
              <dl className="space-y-md text-label">
                <div>
                  <dt className="text-text-secondary">Account status</dt>
                  <dd className="mt-xs">
                    {selected.user.is_active ? "Active" : "Suspended"}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Email verification</dt>
                  <dd className="mt-xs">
                    {selected.user.email_verified ? "Verified" : "Not verified"}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-secondary">User ID</dt>
                  <dd className="mt-xs break-all">{selected.user.id}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Active sessions</dt>
                  <dd className="mt-xs">
                    {selected.user.active_sessions ?? "Unavailable"}
                  </dd>
                </div>
                {selected.user.created_at && (
                  <div>
                    <dt className="text-text-secondary">Registered</dt>
                    <dd className="mt-xs">
                      {dateLabel(selected.user.created_at)}
                    </dd>
                  </div>
                )}
                {selected.user.suspension_reason && (
                  <div>
                    <dt className="text-text-secondary">Suspension reason</dt>
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
                  Revoke access
                </Button>
                <Button
                  variant="text"
                  disabled={
                    selected.user.id === viewer.id || !selected.user.is_active
                  }
                  onClick={() => open(selected.user, "suspend")}
                >
                  Suspend account
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-md">
              <p className="text-label text-text-secondary">
                {selected.action === "revoke"
                  ? "End active sessions for this user. They may sign in again with valid credentials."
                  : "Block authenticated access for this account. Existing event, ticket, and order records remain retained."}
              </p>
              <Textarea
                label={
                  selected.action === "revoke"
                    ? "Access revocation reason"
                    : "Account suspension reason"
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
                    ? "Session revocation requires a new backend route. Demo data supports the complete preview."
                    : "Custom restriction reasons are not yet retained by the live backend."}
                </p>
              )}
              <Button type="submit" loading={busy} className="w-full bg-error">
                {selected.action === "revoke"
                  ? "Confirm access revocation"
                  : "Confirm account suspension"}
              </Button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
