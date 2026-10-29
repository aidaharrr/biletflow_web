"use client";
import { useCallback, useState } from "react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AdminErrorState, AdminHeader } from "@/components/admin/AdminStates";
import { useAdmin } from "@/components/admin/AdminShell";
import { campaignStateLabel, dateLabel, discountLabel } from "@/lib/organizer";
import { useApiData } from "@/hooks/useApiData";
export default function AdminCampaigns() {
  const { api, revision } = useAdmin();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const load = useCallback(
    (signal: AbortSignal) => {
      void revision;
      return api.getCampaigns({ signal, query });
    },
    [api, query, revision],
  );
  const resource = useApiData(load);
  const header = (
    <AdminHeader
      title="Promo activity"
      description="Review promotional codes, Campaign QR traffic, and redemptions across all events."
      action={
        <Button variant="outlined" onClick={resource.retry}>
          Refresh
        </Button>
      }
    />
  );
  if (resource.loading)
    return <LoadingSpinner label="Loading promotional activity…" />;
  if (resource.error || !resource.data)
    return (
      <>
        {header}
        <AdminErrorState error={resource.error} retry={resource.retry} />
      </>
    );
  return (
    <>
      {header}
      <form
        className="grid items-end gap-md sm:grid-cols-[1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draft.trim());
        }}
      >
        <Input
          label="Search by code or event"
          placeholder="CAMPUS20"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" variant="outlined">
          Search campaigns
        </Button>
      </form>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-label">
            <thead className="border-b border-divider bg-background text-text-secondary">
              <tr>
                {[
                  "Event",
                  "Campaign / Code",
                  "Discount",
                  "State",
                  "Link visits",
                  "Redemptions",
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="px-lg py-md font-medium"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resource.data.map((campaign) => (
                <tr
                  key={campaign.id}
                  className="border-b border-divider last:border-0"
                >
                  <td className="px-lg py-lg">{campaign.event_title}</td>
                  <td className="px-lg py-lg">
                    <p className="font-medium">{campaign.name}</p>
                    <p className="mt-xs font-mono text-primary">
                      {campaign.code}
                    </p>
                    <p className="mt-xs text-text-secondary">
                      Created {dateLabel(campaign.created_at)}
                    </p>
                  </td>
                  <td className="px-lg py-lg">{discountLabel(campaign)}</td>
                  <td className="px-lg py-lg">
                    <Badge
                      variant={
                        campaign.state === "active" ? "success" : "neutral"
                      }
                    >
                      {campaignStateLabel(campaign.state)}
                    </Badge>
                  </td>
                  <td className="px-lg py-lg">{campaign.visits}</td>
                  <td className="px-lg py-lg">
                    {campaign.redemptions} / {campaign.maximum}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!resource.data.length && (
            <div className="space-y-sm p-xl">
              <h2 className="text-title">No promotional campaigns</h2>
              <p className="text-label text-text-secondary">
                Campaigns appear here once organizers create promo codes.
              </p>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
