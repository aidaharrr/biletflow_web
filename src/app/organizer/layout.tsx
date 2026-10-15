import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { User } from "@/types/api";
import { backendFetch, SESSION_COOKIE } from "@/lib/server-api";
import { OrganizerShell } from "@/components/organizer/OrganizerShell";
import { Card } from "@/components/ui";
import Link from "next/link";
export default async function OrganizerLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await cookies()).has(SESSION_COOKIE))
    redirect("/login?next=%2Forganizer%2Fdashboard");
  let response: Response;
  try {
    response = await backendFetch("users/me");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-md py-xl">
        <Card>
          <h1 className="text-title">Unable to check your account</h1>
          <p className="mt-md">Please reload when the backend is available.</p>
        </Card>
      </main>
    );
  }
  if (response.status === 401) redirect("/login?next=%2Forganizer%2Fdashboard");
  if (!response.ok)
    return (
      <main className="mx-auto max-w-3xl px-md py-xl">
        <Card>
          <h1 className="text-title">Organizer access unavailable</h1>
          <p className="mt-md">
            Your account could not be authorized. Please sign in again or
            contact support.
          </p>
        </Card>
      </main>
    );
  const user: User = await response.json();
  if (!user.roles.includes("organizer"))
    return (
      <main className="mx-auto max-w-3xl px-md py-xl">
        <Card className="space-y-md">
          <h1 className="text-title">Organizer access required</h1>
          <p>Your account needs the organizer role to manage events.</p>
          <Link href="/events" className="underline">
            Return to events
          </Link>
        </Card>
      </main>
    );
  return <OrganizerShell>{children}</OrganizerShell>;
}
