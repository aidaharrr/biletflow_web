"use client";
import { useCallback, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useApiData } from "@/hooks/useApiData";
import {
  assignCheckInStaff,
  grantSupportStaff,
  listCheckInStaff,
  listSupportStaff,
  removeCheckInStaff,
  revokeSupportStaff,
} from "@/lib/api";
import type { Event } from "@/types/api";

type Access = "check_in" | "support";

/** Organizer screen for giving registered users scanner or support access to one event. */
export function StaffManager({ event }: { event: Event }) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [checkIn, support] = await Promise.all([
        listCheckInStaff(event.id, { signal }),
        listSupportStaff(event.id, { signal }),
      ]);
      return { checkIn, support };
    },
    [event.id],
  );
  const staff = useApiData(load);
  const t = useTranslations("staff");
  const [access, setAccess] = useState<Access>("check_in");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const open = ["draft", "published"].includes(event.status);

  async function run(name: string, action: () => Promise<string>) {
    setBusy(name);
    setError(null);
    setNotice("");
    try {
      setNotice(await action());
      staff.retry();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(null);
    }
  }

  async function invite(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
      setError(new Error(t("invalidEmail")));
      return;
    }
    await run("invite", async () => {
      if (access === "check_in") {
        const member = await assignCheckInStaff(event.id, address);
        setEmail("");
        return t("notices.checkInAdded", { name: member.name });
      }
      const member = await grantSupportStaff(event.id, address);
      setEmail("");
      return t("notices.supportAdded", { name: member.name });
    });
  }

  return (
    <section className="space-y-lg" aria-labelledby="staff-heading">
      <div className="space-y-sm">
        <h2 id="staff-heading" className="text-title">
          {t("heading")}
        </h2>
        <p className="text-label text-text-secondary">{t("intro")}</p>
      </div>
      {open && (
        <Card>
          <form
            onSubmit={invite}
            className="grid items-end gap-md sm:grid-cols-[1fr_220px_auto]"
          >
            <Input
              label={t("email")}
              type="email"
              autoComplete="off"
              value={email}
              onChange={(change) => setEmail(change.target.value)}
              required
              disabled={!!busy}
            />
            <Select
              label={t("access")}
              value={access}
              onChange={(change) => setAccess(change.target.value as Access)}
              disabled={!!busy}
            >
              <option value="check_in">{t("accessCheckIn")}</option>
              <option value="support">{t("accessSupport")}</option>
            </Select>
            <Button type="submit" loading={busy === "invite"} disabled={!!busy}>
              {t("assign")}
            </Button>
          </form>
          <p className="mt-md text-label text-text-secondary">
            {t("accountNote")}
          </p>
        </Card>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-input border border-success/30 bg-success/5 p-md text-label"
        >
          {notice}
        </p>
      )}
      {!!error && <ErrorState error={error} />}
      {staff.loading ? (
        <LoadingSpinner label={t("loading")} />
      ) : staff.error || !staff.data ? (
        <ErrorState error={staff.error} retry={staff.retry} />
      ) : (
        <div className="grid gap-lg md:grid-cols-2">
          <StaffList
            title={t("checkIn.title")}
            badge={t("checkIn.badge")}
            empty={t("checkIn.empty")}
            removeLabel={t("remove")}
            people={staff.data.checkIn.map((member) => ({
              id: member.user_id,
              name: member.name,
              detail: member.email,
            }))}
            busy={busy}
            onRemove={(person) =>
              run(`check_in:${person.id}`, async () => {
                await removeCheckInStaff(event.id, person.id);
                return t("notices.checkInRemoved", { name: person.name });
              })
            }
            removeKey="check_in"
          />
          <StaffList
            title={t("support.title")}
            badge={t("support.badge")}
            empty={t("support.empty")}
            removeLabel={t("remove")}
            people={staff.data.support.map((member) => ({
              id: member.id,
              name: member.name,
            }))}
            busy={busy}
            onRemove={(person) =>
              run(`support:${person.id}`, async () => {
                await revokeSupportStaff(event.id, person.id);
                return t("notices.supportRemoved", { name: person.name });
              })
            }
            removeKey="support"
          />
        </div>
      )}
    </section>
  );
}

function StaffList({
  title,
  badge,
  empty,
  removeLabel,
  people,
  busy,
  onRemove,
  removeKey,
}: {
  title: string;
  badge: string;
  empty: string;
  removeLabel: string;
  people: { id: string; name: string; detail?: string }[];
  busy: string | null;
  onRemove: (person: { id: string; name: string }) => void;
  removeKey: string;
}) {
  return (
    <Card className="space-y-md">
      <h3 className="font-medium">
        {title} ({people.length})
      </h3>
      {people.length ? (
        <ul className="space-y-sm">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex flex-wrap items-center justify-between gap-sm rounded-input border border-divider p-md"
            >
              <div className="min-w-0">
                <p className="break-words text-label font-medium">
                  {person.name} <Badge>{badge}</Badge>
                </p>
                {person.detail && person.detail !== person.name && (
                  <p className="break-all text-label text-text-secondary">
                    {person.detail}
                  </p>
                )}
              </div>
              <Button
                variant="text"
                className="px-sm text-label text-error"
                loading={busy === `${removeKey}:${person.id}`}
                disabled={!!busy}
                onClick={() => onRemove(person)}
              >
                {removeLabel}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-label text-text-secondary">{empty}</p>
      )}
    </Card>
  );
}
