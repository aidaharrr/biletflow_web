import { CampaignRedirect } from "@/components/events/CampaignRedirect";
export default async function CampaignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <CampaignRedirect token={(await params).token} />;
}
