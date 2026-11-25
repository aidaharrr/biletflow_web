"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useIntlLocale, useLabel } from "@/i18n/labels";
import { formatKZT } from "@/lib/money";
import { Badge, Button, Card, Input } from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AdminErrorState, AdminHeader } from "@/components/admin/AdminStates";
import { useAdmin } from "@/components/admin/AdminShell";
import { campaignStateLabel, dateLabel } from "@/lib/organizer";
import { useApiData } from "@/hooks/useApiData";
export default function AdminCampaigns() {
  const t = useTranslations("admin.campaigns");
  const label = useLabel();
  const locale = useIntlLocale();
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
      title={t("title")}
      description={t("description")}
      action={
        <Button variant="outlined" onClick={resource.retry}>
          {t("refresh")}
        </Button>
      }
    />
  );
  if (resource.loading) return <LoadingSpinner label={t("loading")} />;
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
          label={t("searchLabel")}
          placeholder="CAMPUS20"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" variant="outlined">
          {t("search")}
        </Button>
      </form>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-label">
            <thead className="border-b border-divider bg-background text-text-secondary">
              <tr>
                {(
                  [
                    "event",
                    "campaign",
                    "discount",
                    "state",
                    "visits",
                    "redemptions",
                  ] as const
                ).map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="px-lg py-md font-medium"
                  >
                    {t(`columns.${column}`)}
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
                      {t("created", {
                        date: dateLabel(campaign.created_at, locale),
                      })}
                    </p>
                  </td>
                  <td className="px-lg py-lg">
                    {campaign.discount_type === "percentage"
                      ? `${campaign.discount_value}%`
                      : formatKZT(campaign.discount_value)}
                  </td>
                  <td className="px-lg py-lg">
                    <Badge
                      variant={
                        campaign.state === "active" ? "success" : "neutral"
                      }
                    >
                      {label(campaignStateLabel(campaign.state))}
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
              <h2 className="text-title">{t("emptyTitle")}</h2>
              <p className="text-label text-text-secondary">{t("emptyBody")}</p>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
