import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { User } from "@/types/api";
import { backendFetch, SESSION_COOKIE } from "@/lib/server-api";
import { OrganizerShell } from "@/components/organizer/OrganizerShell";
import { Card } from "@/components/ui";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
export default async function OrganizerLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await cookies()).has(SESSION_COOKIE))
    redirect("/login?next=%2Forganizer%2Fdashboard");
  const t = await getTranslations("organizer.layout");
  let response: Response;
  try {
    response = await backendFetch("users/me");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-md py-xl">
        <Card>
          <h1 className="text-title">{t("checkFailedTitle")}</h1>
          <p className="mt-md">{t("checkFailedBody")}</p>
        </Card>
      </main>
    );
  }
  if (response.status === 401) redirect("/login?next=%2Forganizer%2Fdashboard");
  if (!response.ok)
    return (
      <main className="mx-auto max-w-3xl px-md py-xl">
        <Card>
          <h1 className="text-title">{t("unavailableTitle")}</h1>
          <p className="mt-md">{t("unavailableBody")}</p>
        </Card>
      </main>
    );
  const user: User = await response.json();
  if (!user.roles.includes("organizer"))
    return (
      <main className="mx-auto max-w-3xl px-md py-xl">
        <Card className="space-y-md">
          <h1 className="text-title">{t("requiredTitle")}</h1>
          <p>{t("requiredBody")}</p>
          <div className="flex flex-wrap gap-lg">
            <Link
              href="/become-organizer"
              className="font-medium text-primary underline"
            >
              {t("apply")}
            </Link>
            <Link href="/events" className="underline">
              {t("returnToEvents")}
            </Link>
          </div>
        </Card>
      </main>
    );
  return <OrganizerShell>{children}</OrganizerShell>;
}
