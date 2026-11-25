import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("admin.layout");
  if (access.status === 401) redirect("/login?next=%2Fadmin%2Fdashboard");
  if (!access.user)
    return (
      <AdminAccessProblem
        message={
          access.status === 403 ? t("needsAdminRole") : t("sessionUnverified")
        }
      />
    );
  return (
    <Suspense fallback={<LoadingSpinner label={t("loadingPortal")} />}>
      <AdminShell initialUser={access.user}>{children}</AdminShell>
    </Suspense>
  );
}
