import { EventAnalytics } from "@/components/organizer/EventAnalytics";
export default async function OrganizerEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventAnalytics key={id} id={id} />;
}
