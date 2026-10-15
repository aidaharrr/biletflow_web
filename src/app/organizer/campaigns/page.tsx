import { CampaignManager } from "@/components/organizer/CampaignManager";
export default async function CampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; new?: string }>;
}) {
  const query = await searchParams;
  return (
    <CampaignManager
      initialEvent={typeof query.event === "string" ? query.event : ""}
      createInitially={query.new === "1"}
    />
  );
}
