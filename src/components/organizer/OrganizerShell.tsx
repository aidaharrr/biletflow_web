"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { Button, Card } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { useState, type ReactNode } from "react";
const navigation = [
  ["/organizer/dashboard", "Overview"],
  ["/organizer/events/create", "Create event"],
  ["/organizer/campaigns", "Campaigns"],
  ["/organizer/support", "Support inbox"],
];
export function OrganizerShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { user, signOut, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  if (!loading && !user)
    return (
      <main className="mx-auto max-w-3xl px-md py-xl">
        <Card className="space-y-md">
          <h1 className="text-title">Sign in to your organizer account</h1>
          <Link
            href={`/login?next=${encodeURIComponent(path)}`}
            className="underline"
          >
            Sign in
          </Link>
        </Card>
      </main>
    );
  if (user && !user.roles.includes("organizer"))
    return (
      <main className="mx-auto max-w-3xl px-md py-xl">
        <Card>Organizer access required.</Card>
      </main>
    );
  return (
    <div className="mx-auto grid max-w-[1440px] items-start gap-lg px-md py-lg sm:px-lg lg:grid-cols-[220px_minmax(0,1fr)] lg:px-xl lg:py-xl">
      <aside className="space-y-lg lg:sticky lg:top-lg">
        <div className="px-sm">
          <p className="text-label font-medium uppercase tracking-widest text-primary">
            Organizer portal
          </p>
          <p className="mt-sm text-label text-text-secondary">
            Make every event count.
          </p>
        </div>
        <nav
          aria-label="Organizer navigation"
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
              {label}
            </Link>
          ))}
        </nav>
        <Card className="hidden space-y-md lg:block">
          <p className="break-words text-label font-medium">
            {user?.full_name ?? "Your account"}
          </p>
          <p className="text-label text-text-secondary">
            Sandbox workspace. Sales and fees are simulated.
          </p>
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
            Sign out
          </Button>
          {!!error && <ErrorState error={error} />}
        </Card>
      </aside>
      <main className="min-w-0 space-y-xl">{children}</main>
    </div>
  );
}
