"use client";
import { useCallback, useState, type FormEvent } from "react";
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
      setError(new Error("Enter the email address of a registered account."));
      return;
    }
    await run("invite", async () => {
      if (access === "check_in") {
        const member = await assignCheckInStaff(event.id, address);
        setEmail("");
        return `${member.name} can now check in attendees for this event in the BiletFlow mobile app.`;
      }
      const member = await grantSupportStaff(event.id, address);
      setEmail("");
      return `${member.name} can now handle and be assigned this event's support cases.`;
    });
  }

  return (
    <section className="space-y-lg" aria-labelledby="staff-heading">
      <div className="space-y-sm">
        <h2 id="staff-heading" className="text-title">
          Event staff
        </h2>
        <p className="text-label text-text-secondary">
          Give a registered BiletFlow user access to this event only. Check-in
          staff sign in to the mobile app to scan tickets. Support agents can
          answer and be assigned this event&apos;s support cases.
        </p>
      </div>
      {open && (
        <Card>
          <form
            onSubmit={invite}
            className="grid items-end gap-md sm:grid-cols-[1fr_220px_auto]"
          >
            <Input
              label="Staff member email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(change) => setEmail(change.target.value)}
              required
              disabled={!!busy}
            />
            <Select
              label="Access"
              value={access}
              onChange={(change) => setAccess(change.target.value as Access)}
              disabled={!!busy}
            >
              <option value="check_in">Check-in (mobile scanner)</option>
              <option value="support">Support agent</option>
            </Select>
            <Button type="submit" loading={busy === "invite"} disabled={!!busy}>
              Assign
            </Button>
          </form>
          <p className="mt-md text-label text-text-secondary">
            The person must already have an account. Ask them to register first
            if the email is not found.
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
        <LoadingSpinner label="Loading event staff…" />
      ) : staff.error || !staff.data ? (
        <ErrorState error={staff.error} retry={staff.retry} />
      ) : (
        <div className="grid gap-lg md:grid-cols-2">
          <StaffList
            title="Check-in staff"
            badge="Scanner"
            empty="No check-in staff yet. Only you can scan tickets for this event."
            people={staff.data.checkIn.map((member) => ({
              id: member.user_id,
              name: member.name,
              detail: member.email,
            }))}
            busy={busy}
            onRemove={(person) =>
              run(`check_in:${person.id}`, async () => {
                await removeCheckInStaff(event.id, person.id);
                return `${person.name} no longer has check-in access.`;
              })
            }
            removeKey="check_in"
          />
          <StaffList
            title="Support agents"
            badge="Support"
            empty="No support agents yet. Cases are assigned to you."
            people={staff.data.support.map((member) => ({
              id: member.id,
              name: member.name,
            }))}
            busy={busy}
            onRemove={(person) =>
              run(`support:${person.id}`, async () => {
                await revokeSupportStaff(event.id, person.id);
                return `${person.name} no longer handles support. Their open cases were unassigned.`;
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
  people,
  busy,
  onRemove,
  removeKey,
}: {
  title: string;
  badge: string;
  empty: string;
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
                Remove
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
