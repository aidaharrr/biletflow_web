"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { Button, Card } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
const navigation = [
  ["/organizer/dashboard", "overview"],
  ["/organizer/events/create", "createEvent"],
  ["/organizer/campaigns", "campaigns"],
  ["/organizer/support", "support"],
] as const;
export function OrganizerShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const t = useTranslations("organizer.shell");
  if (!loading && !user)
    return (
      <main className="mx-auto max-w-3xl px-md py-xl">
        <Card className="space-y-md">
          <h1 className="text-title">{t("signInTitle")}</h1>
          <Link
            href={`/login?next=${encodeURIComponent(path)}`}
            className="underline"
          >
            {t("signIn")}
          </Link>
        </Card>
      </main>
    );
  if (user && !user.roles.includes("organizer"))
    return (
      <main className="mx-auto max-w-3xl px-md py-xl">
        <Card>{t("accessRequired")}</Card>
      </main>
    );
  return (
    <div className="mx-auto grid max-w-[1440px] items-start gap-lg px-md py-lg sm:px-lg lg:grid-cols-[220px_minmax(0,1fr)] lg:px-xl lg:py-xl">
      <aside className="space-y-lg lg:sticky lg:top-lg">
        <div className="px-sm">
          <p className="text-label font-medium uppercase tracking-widest text-primary">
            {t("portal")}
          </p>
          <p className="mt-sm text-label text-text-secondary">{t("tagline")}</p>
        </div>
        <nav
          aria-label={t("navLabel")}
          className="flex flex-wrap gap-sm lg:flex-col"
        >
          {navigation.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
              className={cn(
                "rounded-button px-md py-3 text-label font-medium hover:bg-surface",
                path === href && "bg-primary text-white hover:bg-primary",
              )}
            >
              {t(`nav.${label}`)}
            </Link>
          ))}
        </nav>
        <Card className="hidden space-y-md lg:block">
          <p className="break-words text-label font-medium">
            {user?.full_name ?? t("yourAccount")}
          </p>
          <p className="text-label text-text-secondary">{t("sandbox")}</p>
          <Button
            variant="text"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await signOut();
                router.push("/events");
                router.refresh();
              } catch (error) {
                setError(error);
                setBusy(false);
              }
            }}
          >
            {t("signOut")}
          </Button>
          {!!error && <ErrorState error={error} />}
        </Card>
      </aside>
      <main className="min-w-0 space-y-xl">{children}</main>
    </div>
  );
}
