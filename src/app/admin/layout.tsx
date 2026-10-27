import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/server-admin";
import { SESSION_COOKIE } from "@/lib/server-api";
import { AdminAccessProblem, AdminShell } from "@/components/admin/AdminShell";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await cookies()).has(SESSION_COOKIE))
    redirect("/login?next=%2Fadmin%2Fdashboard");
  const access = await getAdminAccess();
  if (access.status === 401) redirect("/login?next=%2Fadmin%2Fdashboard");
  if (!access.user)
    return (
      <AdminAccessProblem
        message={
          access.status === 403
            ? "Your account needs the Admin role to access this portal."
            : "Your administrator session could not be verified. Check the backend connection and try again."
        }
      />
    );
  return (
    <Suspense fallback={<LoadingSpinner label="Loading admin portal…" />}>
      <AdminShell initialUser={access.user}>{children}</AdminShell>
    </Suspense>
  );
}
