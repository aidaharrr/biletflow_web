"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge, Button, Card } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { createLiveAdminApi } from "@/lib/api";
import { createAdminDemoApi } from "@/lib/admin-demo";
import { adminHref, hasAdminRole } from "@/lib/admin";
import { cn } from "@/lib/cn";
import type { AdminApi, AdminMode, User } from "@/types/api";
interface AdminContextState {
  api: AdminApi;
  mode: AdminMode;
  revision: number;
  refresh: () => void;
  viewer: User;
  href: (path: string) => string;
}
const AdminContext = createContext<AdminContextState | null>(null);
const navigation = [
  ["/admin/dashboard", "Overview"],
  ["/admin/organizers", "Organizer reviews"],
  ["/admin/events", "Event moderation"],
  ["/admin/users", "User management"],
];
export function AdminShell({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: User;
}) {
  const path = usePathname();
  const query = useSearchParams();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const mode: AdminMode = query.get("mode") === "demo" ? "demo" : "live";
  const [demo] = useState(() => createAdminDemoApi(initialUser));
  const [live] = useState(() => createLiveAdminApi());
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const current = `${path}${query.toString() ? `?${query}` : ""}`;
  if (!loading && !hasAdminRole(user))
    return (
      <main className="mx-auto max-w-3xl px-md py-xl">
        <Card className="space-y-md">
          <h1 className="text-title">Admin access required</h1>
          <p>Sign in with an active platform administrator account.</p>
          <Link
            href={`/login?next=${encodeURIComponent(current)}`}
            className="underline"
          >
            Sign in
          </Link>
        </Card>
      </main>
    );
  return (
    <AdminContext.Provider
      value={{
        api: mode === "demo" ? demo : live,
        mode,
        revision,
        refresh: () => setRevision((value) => value + 1),
        viewer: user ?? initialUser,
        href: (target) => adminHref(target, mode),
      }}
    >
      <div className="mx-auto grid max-w-[1440px] items-start gap-lg px-md py-lg sm:px-lg lg:grid-cols-[220px_minmax(0,1fr)] lg:px-xl lg:py-xl">
        <aside className="space-y-lg lg:sticky lg:top-lg">
          <div className="px-sm">
            <p className="text-label font-medium uppercase tracking-widest text-primary">
              Platform admin
            </p>
            <p className="mt-sm text-label text-text-secondary">
              Review. Moderate. Keep trust.
            </p>
          </div>
          <nav
            aria-label="Admin navigation"
            className="flex flex-wrap gap-sm lg:flex-col"
          >
            {navigation.map(([target, label]) => (
              <Link
                key={target}
                href={adminHref(target, mode)}
                aria-current={path === target ? "page" : undefined}
                className={cn(
                  "rounded-button px-md py-3 text-label font-medium hover:bg-surface",
                  path === target && "bg-primary text-white hover:bg-primary",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Card className="space-y-md">
            <Badge>Admin</Badge>
            <p className="break-words text-label font-medium">
              {user?.full_name ?? initialUser.full_name ?? "Administrator"}
            </p>
            <Button
              variant="text"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
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
        <main className="min-w-0 space-y-xl">
          <section
            aria-label="Admin data source"
            className={cn(
              "flex flex-wrap items-center justify-between gap-md rounded-card border p-md",
              mode === "demo"
                ? "border-primary/30 bg-primary/5"
                : "border-divider bg-surface",
            )}
          >
            <div className="min-w-0 space-y-sm">
              <Badge variant={mode === "demo" ? "neutral" : "success"}>
                {mode === "demo" ? "Demo mode — sample data" : "Live data"}
              </Badge>
              <p className="max-w-3xl text-label text-text-secondary">
                {mode === "demo"
                  ? "Biweekly report preview. Actions update sample records in this tab and reset on reload. Your real platform records are unaffected."
                  : "Actions affect platform records. Missing review APIs show an unavailable state; choose Demo data for the complete report preview."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-md">
              {mode === "demo" && (
                <Button
                  variant="text"
                  className="text-label"
                  onClick={() => {
                    demo.reset();
                    setRevision((value) => value + 1);
                  }}
                >
                  Reset demo data
                </Button>
              )}
              <Link
                href={adminHref(current, mode === "demo" ? "live" : "demo")}
                className="inline-flex min-h-button items-center rounded-button border border-text-primary bg-surface px-md py-3 text-label font-medium"
              >
                {mode === "demo" ? "Use live data" : "Use demo data"}
              </Link>
            </div>
          </section>
          {children}
        </main>
      </div>
    </AdminContext.Provider>
  );
}
export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("Admin pages must use AdminShell.");
  return context;
}
/** A retry keeps its key only while action details remain the same. */
export function useAdminRequestKey() {
  const ref = useRef<{ signature: string; key: string } | null>(null);
  return (signature: string) => {
    if (ref.current?.signature !== signature)
      ref.current = { signature, key: crypto.randomUUID() };
    return ref.current.key;
  };
}
export function AdminAccessProblem({ message }: { message: string }) {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-3xl px-md py-xl">
      <Card className="space-y-lg">
        <h1 className="text-title">Admin access unavailable</h1>
        <p>{message}</p>
        <Button onClick={() => router.refresh()}>Retry access check</Button>
      </Card>
    </main>
  );
}
