import { EventWizard } from "@/components/organizer/EventWizard";
export default async function CreateEventPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; source?: string }>;
}) {
  const query = await searchParams;
  return (
    <EventWizard
      key={query.draft ?? "new"}
      draftId={typeof query.draft === "string" ? query.draft : undefined}
      sourceId={typeof query.source === "string" ? query.source : undefined}
    />
  );
}
