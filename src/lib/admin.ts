import type {
  AdminEvent,
  AdminMode,
  AdminUser,
  OrganizerApplication,
  User,
} from "@/types/api";
export const hasAdminRole = (user: User | null | undefined) =>
  !!user?.roles.includes("platform_admin") && user.is_active !== false;
export const roleLabel = (role: string) =>
  ({
    platform_admin: "Admin",
    event_admin: "Event Admin",
    organizer: "Organizer",
    attendee: "Attendee",
  })[role] ?? role;
export const isSuspendedEvent = (event: AdminEvent) =>
  event.moderation_status === "suspended" ||
  (event.paid_sales_status === "suspended" && event.status !== "cancelled");
export const isHiddenEvent = (event: AdminEvent) =>
  event.status !== "published" || event.visibility === "private";
export const isActiveEvent = (event: AdminEvent, at: number) =>
  event.status === "published" &&
  event.visibility !== "private" &&
  !isSuspendedEvent(event) &&
  Date.parse(event.ends_at) > at;
export function approvalRequirements(application: OrganizerApplication) {
  return {
    "Sandbox identity verified":
      application.profile.verification_status === "verified",
    "Sandbox payout verified": application.profile.payout_verified,
    "Paid-event terms accepted": application.terms_accepted,
    "Simulated activation fee paid": application.activation_fee_paid,
  };
}
export const canApproveOrganizer = (application: OrganizerApplication) =>
  application.status === "pending" &&
  Object.values(approvalRequirements(application)).every(Boolean);
export function adminHref(path: string, mode: AdminMode) {
  const url = new URL(path, "https://admin.internal");
  if (
    url.origin !== "https://admin.internal" ||
    !/^\/admin(?:\/|$)/.test(url.pathname)
  )
    throw new Error("Admin links must stay inside the portal.");
  if (mode === "demo") url.searchParams.set("mode", "demo");
  else url.searchParams.delete("mode");
  return `${url.pathname}${url.search}${url.hash}`;
}
export function filterAdminUsers(
  users: AdminUser[],
  query: string,
  status: string,
) {
  const needle = query.trim().toLowerCase();
  return users.filter(
    (user) =>
      (!status ||
        (status === "suspended"
          ? user.is_active === false
          : user.is_active !== false)) &&
      [user.email, user.full_name ?? ""].some((value) =>
        value.toLowerCase().includes(needle),
      ),
  );
}
export function filterAdminEvents(
  events: AdminEvent[],
  query: string,
  status: string,
) {
  const needle = query.trim().toLowerCase();
  return events.filter(
    (event) =>
      (!status ||
        (status === "suspended"
          ? isSuspendedEvent(event)
          : event.status === status && !isSuspendedEvent(event))) &&
      [event.title, event.organizer_name, event.venue.name].some((value) =>
        value.toLowerCase().includes(needle),
      ),
  );
}
