"use client";
import Link from "next/link";
import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
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
import { useIntlLocale } from "@/i18n/labels";
import type { OrganizerApplicationRecord } from "@/types/api";

const STEPS = ["submit", "review", "approved", "publish"] as const;

export default function BecomeOrganizerPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const t = useTranslations("becomeOrganizer");
  const locale = useIntlLocale();
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

  if (authLoading) return <LoadingSpinner label={t("checkingAccount")} />;
  if (!user)
    return (
      <Shell>
        <Card className="space-y-lg">
          <p>{t("signedOut.prompt")}</p>
          <div className="flex flex-wrap gap-md">
            <Link
              href="/login?next=%2Fbecome-organizer"
              className="inline-block rounded-button bg-primary px-5 py-3.5 font-medium text-white"
            >
              {t("signedOut.signIn")}
            </Link>
            <Link
              href="/register"
              className="inline-block rounded-button border border-text-primary px-5 py-3.5 font-medium"
            >
              {t("signedOut.createAccount")}
            </Link>
          </div>
        </Card>
      </Shell>
    );
  if (isOrganizer)
    return (
      <Shell>
        <Card className="space-y-lg">
          <Badge variant="success">{t("organizer.badge")}</Badge>
          <p>{t("organizer.body")}</p>
          <Link
            href="/organizer/dashboard"
            className="inline-block rounded-button bg-primary px-5 py-3.5 font-medium text-white"
          >
            {t("organizer.openPortal")}
          </Link>
        </Card>
      </Shell>
    );
  if (resource.loading)
    return <LoadingSpinner label={t("loadingApplication")} />;
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
            <h2 className="text-title">{t("application.title")}</h2>
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
                ? t("application.statusPending")
                : application.status === "approved"
                  ? t("application.statusApproved")
                  : t("application.statusRejected")}
            </Badge>
          </div>
          <p className="text-label text-text-secondary">
            {t("application.submitted", {
              organization: application.organization_name,
              date: dateLabel(application.created_at, locale),
            })}
          </p>
          {application.status === "pending" && (
            <p className="text-label">{t("application.pendingBody")}</p>
          )}
          {application.status === "approved" && (
            <p className="text-label">{t("application.approvedBody")}</p>
          )}
          {application.status === "rejected" && (
            <p role="alert" className="text-label text-error">
              {t("application.rejectedBody")}
            </p>
          )}
          {application.status !== "rejected" && (
            <Button variant="outlined" loading={checking} onClick={checkStatus}>
              {application.status === "approved"
                ? t("application.refreshAccess")
                : t("application.checkStatus")}
            </Button>
          )}
        </Card>
      )}
      {canApply && (
        <Card>
          <form onSubmit={submit} className="space-y-md">
            <h2 className="text-title">
              {application ? t("form.applyAgain") : t("form.title")}
            </h2>
            <Input
              label={t("form.contactName")}
              name="contact_name"
              defaultValue={application?.contact_name ?? user.full_name ?? ""}
              required
              minLength={2}
              maxLength={200}
              disabled={busy}
            />
            <Input
              label={t("form.organizationName")}
              name="organization_name"
              defaultValue={application?.organization_name ?? ""}
              required
              minLength={2}
              maxLength={200}
              disabled={busy}
            />
            <Input
              label={t("form.contactPhone")}
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
              label={t("form.description")}
              name="description"
              defaultValue={application?.description ?? ""}
              required
              minLength={10}
              maxLength={2000}
              disabled={busy}
            />
            {!!error && <ErrorState error={error} />}
            <Button type="submit" loading={busy} disabled={busy}>
              {t("form.submit")}
            </Button>
          </form>
        </Card>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const t = useTranslations("becomeOrganizer");
  return (
    <main className="mx-auto max-w-[40rem] space-y-lg px-md py-xl">
      <div className="space-y-sm">
        <h1 className="font-brand text-2xl font-semibold">{t("title")}</h1>
        <ol className="list-decimal space-y-xs pl-lg text-label text-text-secondary">
          {STEPS.map((step) => (
            <li key={step}>{t(`steps.${step}`)}</li>
          ))}
        </ol>
      </div>
      {children}
    </main>
  );
}
