"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  SupportThread,
  useSupportStatusLabel,
} from "@/components/organizer/SupportInbox";
import { Badge, Button, Card } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { usePollingData } from "@/hooks/usePollingData";
import { listSupportCases } from "@/lib/api";
import { dateLabel } from "@/lib/organizer";
import { useTranslations } from "next-intl";
import { useIntlLocale } from "@/i18n/labels";

/** Attendee view of their own support requests and the replies to them. */
export function MySupport({ initialCase = "" }: { initialCase?: string }) {
  const t = useTranslations("support");
  const statusText = useSupportStatusLabel();
  const locale = useIntlLocale();
  const { user, loading: authLoading } = useAuth();
  const [selected, setSelected] = useState(initialCase);
  const load = useCallback(
    (signal: AbortSignal) =>
      user
        ? listSupportCases({
            signal,
            params: { view: "mine", flow: "attendee" },
          })
        : Promise.resolve([]),
    [user],
  );
  const resource = usePollingData(load, 30000);
  if (authLoading)
    return <LoadingSpinner label={t("MySupport.checkingAccount")} />;
  if (!user)
    return (
      <main className="mx-auto max-w-[32rem] px-md py-xl">
        <Card className="space-y-lg">
          <h1 className="font-brand text-2xl font-semibold">
            {t("MySupport.title")}
          </h1>
          <p className="text-text-secondary">{t("MySupport.signedOutBody")}</p>
          <Link
            className="inline-block rounded-button bg-primary px-5 py-3.5 font-medium text-white"
            href="/login?next=%2Fsupport"
          >
            {t("MySupport.signIn")}
          </Link>
        </Card>
      </main>
    );
  const cases = resource.data ?? [];
  const active = cases.find((item) => item.id === selected) ?? cases[0];
  return (
    <main className="mx-auto max-w-6xl space-y-xl px-md py-xl sm:px-lg">
      <header className="space-y-sm">
        <h1 className="font-brand text-3xl font-semibold">
          {t("MySupport.title")}
        </h1>
        <p className="text-label text-text-secondary">{t("MySupport.intro")}</p>
      </header>
      {resource.loading ? (
        <LoadingSpinner label={t("MySupport.loading")} />
      ) : !resource.data ? (
        <ErrorState error={resource.error} retry={resource.retry} />
      ) : !cases.length ? (
        <Card className="space-y-md">
          <h2 className="text-title">{t("MySupport.emptyTitle")}</h2>
          <p className="text-text-secondary">
            {t.rich("MySupport.emptyBody", {
              link: (chunks) => (
                <Link href="/tickets" className="underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </Card>
      ) : (
        <div className="grid items-start gap-lg lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="space-y-md">
            <div className="flex items-center justify-between gap-sm">
              <h2 className="text-title">
                {t("MySupport.listTitle", { count: cases.length })}
              </h2>
              <Button
                variant="text"
                className="px-sm text-label"
                loading={resource.refreshing}
                onClick={resource.retry}
              >
                {t("MySupport.refresh")}
              </Button>
            </div>
            <div className="max-h-[650px] space-y-sm overflow-y-auto">
              {cases.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelected(item.id)}
                  aria-pressed={active?.id === item.id}
                  className={`w-full rounded-input border p-md text-left ${active?.id === item.id ? "border-primary bg-primary/5" : "border-divider hover:bg-background"}`}
                >
                  <span className="block break-words text-label font-medium">
                    {item.subject}
                  </span>
                  <span className="mt-sm block text-label text-text-secondary">
                    {item.event_title ?? t("MySupport.generalSupport")}
                  </span>
                  <span className="mt-sm block">
                    <Badge
                      variant={
                        item.status === "resolved" ? "success" : "neutral"
                      }
                    >
                      {statusText(item.status)}
                    </Badge>
                  </span>
                  <span className="mt-sm block text-label text-text-secondary">
                    {dateLabel(item.updated_at, locale)}
                  </span>
                </button>
              ))}
            </div>
          </Card>
          {active && (
            <SupportThread
              key={active.id}
              supportCase={active}
              onUpdated={resource.retry}
            />
          )}
        </div>
      )}
      {!!resource.error && !!resource.data && (
        <ErrorState error={resource.error} retry={resource.retry} />
      )}
    </main>
  );
}
