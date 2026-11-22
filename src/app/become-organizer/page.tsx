"use client";
import Link from "next/link";
import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge, Button, Card, Input, Textarea } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useApiData } from "@/hooks/useApiData";
import {
  getMyOrganizerApplication,
  submitOrganizerApplication,
} from "@/lib/api";
import { dateLabel } from "@/lib/organizer";
import type { OrganizerApplicationRecord } from "@/types/api";

const STEPS = [
  "Submit your organizer details below.",
  "A platform administrator reviews the application.",
  "Once approved, the Organizer portal appears in the menu and you can create events.",
  "Free events can be published straight away. Paid events also need a sandbox paid-sales checklist and a separate admin review.",
];

export default function BecomeOrganizerPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const isOrganizer =
    !!user &&
    (user.roles.includes("organizer") || user.roles.includes("platform_admin"));
  const load = useCallback(
    (signal: AbortSignal) =>
      user && !isOrganizer
        ? getMyOrganizerApplication({ signal })
        : Promise.resolve(null),
    [user, isOrganizer],
  );
  const resource = useApiData(load);
  const [submitted, setSubmitted] = useState<OrganizerApplicationRecord | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [checking, setChecking] = useState(false);
  const key = useRef<{ signature: string; value: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      contact_name: String(form.get("contact_name")).trim(),
      organization_name: String(form.get("organization_name")).trim(),
      contact_phone: String(form.get("contact_phone")).trim(),
      description: String(form.get("description")).trim(),
    };
    const signature = JSON.stringify(body);
    if (key.current?.signature !== signature)
      key.current = { signature, value: crypto.randomUUID() };
    setBusy(true);
    setError(null);
    try {
      setSubmitted(await submitOrganizerApplication(body, key.current.value));
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  async function checkStatus() {
    setChecking(true);
    try {
      await refresh();
      resource.retry();
    } finally {
      setChecking(false);
    }
  }

  if (authLoading) return <LoadingSpinner label="Checking your account…" />;
  if (!user)
    return (
      <Shell>
        <Card className="space-y-lg">
          <p>Sign in or create an account to apply as an organizer.</p>
          <div className="flex flex-wrap gap-md">
            <Link
              href="/login?next=%2Fbecome-organizer"
              className="inline-block rounded-button bg-primary px-5 py-3.5 font-medium text-white"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-block rounded-button border border-text-primary px-5 py-3.5 font-medium"
            >
              Create account
            </Link>
          </div>
        </Card>
      </Shell>
    );
  if (isOrganizer)
    return (
      <Shell>
        <Card className="space-y-lg">
          <Badge variant="success">Organizer access active</Badge>
          <p>Your account can already create and manage events.</p>
          <Link
            href="/organizer/dashboard"
            className="inline-block rounded-button bg-primary px-5 py-3.5 font-medium text-white"
          >
            Open organizer portal
          </Link>
        </Card>
      </Shell>
    );
  if (resource.loading)
    return <LoadingSpinner label="Loading your organizer application…" />;
  if (resource.error)
    return (
      <Shell>
        <ErrorState error={resource.error} retry={resource.retry} />
      </Shell>
    );
  const application = submitted ?? resource.data;
  const canApply = !application || application.status === "rejected";
  return (
    <Shell>
      {application && (
        <Card className="space-y-md" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-md">
            <h2 className="text-title">Your application</h2>
            <Badge
              variant={
                application.status === "approved"
                  ? "success"
                  : application.status === "rejected"
                    ? "error"
                    : "neutral"
              }
            >
              {application.status === "pending"
                ? "Pending review"
                : application.status === "approved"
                  ? "Approved"
                  : "Rejected"}
            </Badge>
          </div>
          <p className="text-label text-text-secondary">
            {application.organization_name} · submitted{" "}
            {dateLabel(application.created_at)}
          </p>
          {application.status === "pending" && (
            <p className="text-label">
              A platform administrator is reviewing your application. You will
              get a notification when it is decided.
            </p>
          )}
          {application.status === "approved" && (
            <p className="text-label">
              Approved. Refresh your access to open the organizer portal.
            </p>
          )}
          {application.status === "rejected" && (
            <p role="alert" className="text-label text-error">
              Your application was rejected. Check your notifications for the
              administrator&apos;s reason, update your details and apply again.
            </p>
          )}
          {application.status !== "rejected" && (
            <Button variant="outlined" loading={checking} onClick={checkStatus}>
              {application.status === "approved"
                ? "Refresh my access"
                : "Check status"}
            </Button>
          )}
        </Card>
      )}
      {canApply && (
        <Card>
          <form onSubmit={submit} className="space-y-md">
            <h2 className="text-title">
              {application ? "Apply again" : "Organizer details"}
            </h2>
            <Input
              label="Contact name"
              name="contact_name"
              defaultValue={application?.contact_name ?? user.full_name ?? ""}
              required
              minLength={2}
              maxLength={200}
              disabled={busy}
            />
            <Input
              label="Organization name"
              name="organization_name"
              defaultValue={application?.organization_name ?? ""}
              required
              minLength={2}
              maxLength={200}
              disabled={busy}
            />
            <Input
              label="Contact phone"
              name="contact_phone"
              type="tel"
              defaultValue={application?.contact_phone ?? user.phone ?? ""}
              placeholder="+7 700 000 0000"
              required
              minLength={5}
              maxLength={40}
              disabled={busy}
            />
            <Textarea
              label="What events do you organize?"
              name="description"
              defaultValue={application?.description ?? ""}
              required
              minLength={10}
              maxLength={2000}
              disabled={busy}
            />
            {!!error && <ErrorState error={error} />}
            <Button type="submit" loading={busy} disabled={busy}>
              Submit application
            </Button>
          </form>
        </Card>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-[40rem] space-y-lg px-md py-xl">
      <div className="space-y-sm">
        <h1 className="font-brand text-2xl font-semibold">
          Become an organizer
        </h1>
        <ol className="list-decimal space-y-xs pl-lg text-label text-text-secondary">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      {children}
    </main>
  );
}
