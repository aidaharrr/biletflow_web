import { SupportInbox } from "@/components/organizer/SupportInbox";
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; order?: string; ticket?: string }>;
}) {
  const query = await searchParams;
  return (
    <SupportInbox
      eventId={typeof query.event === "string" ? query.event : ""}
      orderId={typeof query.order === "string" ? query.order : undefined}
      ticketId={typeof query.ticket === "string" ? query.ticket : undefined}
    />
  );
}
