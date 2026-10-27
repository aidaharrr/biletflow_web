import { AdminEvents } from "@/components/admin/AdminEvents";
export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const query = await searchParams;
  const eventId = typeof query.event === "string" ? query.event : "";
  return <AdminEvents key={eventId} initialEventId={eventId} />;
}
