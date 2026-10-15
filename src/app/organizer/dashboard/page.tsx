"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Badge, Button, Card, StatCard } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EventActions } from "@/components/organizer/EventActions";
import {
  getOrganizerSummary,
  listCampaigns,
  listOrganizerEvents,
} from "@/lib/api";
import {
  activeCampaign,
  aggregateSummaries,
  eventGroup,
  eventGroups,
  percentText,
  type EventGroup,
} from "@/lib/organizer";
import { eventDate } from "@/lib/events";
import { formatKZT } from "@/lib/money";
import { useApiData } from "@/hooks/useApiData";
import { cn } from "@/lib/cn";
export default function OrganizerDashboard() {
  const [group, setGroup] = useState<EventGroup>("Upcoming");
  const load = useCallback(async (signal: AbortSignal) => {
    const events = await listOrganizerEvents({ signal });
    const rows = await Promise.all(
      events.map(async (event) => {
        const [summary, campaigns] = await Promise.allSettled([
          getOrganizerSummary(event.id, { signal }),
          listCampaigns(event.id, { signal }),
        ]);
        return {
          event,
          summary: summary.status === "fulfilled" ? summary.value : null,
          summaryError: summary.status === "rejected" ? summary.reason : null,
          campaigns: campaigns.status === "fulfilled" ? campaigns.value : null,
          campaignError:
            campaigns.status === "rejected" ? campaigns.reason : null,
        };
      }),
    );
    return { events, rows, asOf: Date.now() };
  }, []);
  const resource = useApiData(load);
  if (resource.loading)
    return <LoadingSpinner label="Loading your dashboard…" />;
  if (resource.error || !resource.data)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  const { events, rows, asOf } = resource.data;
  const summariesComplete = rows.every((row) => row.summary !== null);
  const campaignsComplete = rows.every((row) => row.campaigns !== null);
  const totals = aggregateSummaries(
    rows.flatMap((row) => (row.summary ? [row.summary] : [])),
  );
  const redemptions = rows
    .flatMap((row) => row.campaigns ?? [])
    .filter((campaign) => activeCampaign(campaign, asOf))
    .reduce((sum, campaign) => sum + campaign.redemption_count, 0);
  const shown = rows.filter((row) => eventGroup(row.event, asOf) === group);
  const metricError = rows.find((row) => row.summaryError || row.campaignError);
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-lg">
        <div className="space-y-sm">
          <p className="text-label uppercase tracking-widest text-primary">
            Your events, at a glance
          </p>
          <h1 className="font-brand text-3xl font-semibold">
            Dashboard overview
          </h1>
          <p className="text-label text-text-secondary">
            All managed events · All-time metrics · Demonstration revenue in KZT
          </p>
        </div>
        <Button variant="outlined" onClick={resource.retry}>
          Refresh overview
        </Button>
      </header>
      <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Gross Sales"
          value={summariesComplete ? formatKZT(totals.gross) : "—"}
          helper="Confirmed order subtotals · Sandbox"
          accent
        />
        <StatCard
          label="Tickets Sold vs Capacity"
          value={summariesComplete ? percentText(totals.soldRate) : "—"}
          helper={
            summariesComplete
              ? `${totals.sold} sold / ${totals.capacity} ticket capacity`
              : "Metrics unavailable"
          }
        />
        <StatCard
          label="Check-in Attendance Rate"
          value={summariesComplete ? percentText(totals.attendanceRate) : "—"}
          helper={
            summariesComplete
              ? `${totals.checked} checked in / ${totals.sold} valid tickets`
              : "Metrics unavailable"
          }
        />
        <StatCard
          label="Active Promo Redemptions"
          value={campaignsComplete ? redemptions : "—"}
          helper="Redemptions in currently valid campaigns"
        />
      </div>
      {metricError && (
        <ErrorState
          error={metricError.summaryError ?? metricError.campaignError}
          retry={resource.retry}
        />
      )}
      <div className="flex flex-wrap gap-md">
        <Link
          href="/organizer/events/create"
          className="inline-flex min-h-button items-center justify-center rounded-button bg-primary px-5 py-3.5 font-medium text-white"
        >
          Create New Event
        </Link>
        <Link
          href="/organizer/campaigns?new=1"
          className="inline-flex min-h-button items-center justify-center rounded-button border border-text-primary bg-surface px-5 py-3.5 font-medium"
        >
          Create Promo Campaign
        </Link>
      </div>
      <section className="space-y-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 className="text-title">Your event portfolio</h2>
          <div
            role="tablist"
            aria-label="Event lifecycle"
            className="flex flex-wrap gap-sm"
          >
            {eventGroups.map((value) => (
              <button
                type="button"
                role="tab"
                id={`event-group-${value}`}
                tabIndex={group === value ? 0 : -1}
                aria-selected={group === value}
                aria-controls="event-list"
                key={value}
                className={cn(
                  "rounded-badge border border-divider bg-surface px-md py-sm text-label",
                  group === value && "border-primary bg-primary text-white",
                )}
                onClick={() => setGroup(value)}
                onKeyDown={(event) => {
                  const current = eventGroups.indexOf(group);
                  const next =
                    event.key === "ArrowRight"
                      ? (current + 1) % eventGroups.length
                      : event.key === "ArrowLeft"
                        ? (current + eventGroups.length - 1) %
                          eventGroups.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? eventGroups.length - 1
                            : null;
                  if (next === null) return;
                  event.preventDefault();
                  setGroup(eventGroups[next]);
                  document
                    .getElementById(`event-group-${eventGroups[next]}`)
                    ?.focus();
                }}
              >
                {value} (
                {
                  events.filter((event) => eventGroup(event, asOf) === value)
                    .length
                }
                )
              </button>
            ))}
          </div>
        </div>
        <Card className="overflow-hidden p-0">
          <div
            className="overflow-x-auto"
            id="event-list"
            role="tabpanel"
            aria-label={`${group} events`}
            aria-labelledby={`event-group-${group}`}
          >
            {shown.length ? (
              <table className="w-full min-w-[780px] text-left text-label">
                <thead className="border-b border-divider bg-background text-text-secondary">
                  <tr>
                    {[
                      "Event",
                      "Status",
                      "Ticket sales",
                      "Gross sales",
                      "Actions",
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
                  {shown.map(({ event, summary }) => (
                    <tr
                      key={event.id}
                      className="border-b border-divider last:border-0"
                    >
                      <td className="max-w-64 px-lg py-lg">
                        <Link
                          href={`/organizer/events/${event.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {event.title}
                        </Link>
                        <p className="mt-sm text-text-secondary">
                          {eventDate(event)}
                        </p>
                        <p className="mt-xs text-text-secondary">
                          {event.venue.name}
                        </p>
                      </td>
                      <td className="px-lg py-lg">
                        <Badge
                          variant={
                            event.status === "cancelled"
                              ? "error"
                              : event.status === "published"
                                ? "success"
                                : "neutral"
                          }
                        >
                          {event.status}
                        </Badge>
                      </td>
                      <td className="px-lg py-lg">
                        {summary ? (
                          <>
                            {summary.tickets_sold} / {summary.capacity}
                            <p className="mt-xs text-text-secondary">
                              {percentText(summary.percentage_sold)}
                            </p>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-lg py-lg">
                        {summary ? formatKZT(summary.gross_sales_minor) : "—"}
                      </td>
                      <td className="min-w-64 px-md py-md">
                        <EventActions
                          event={event}
                          onChanged={resource.retry}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="space-y-md p-xl">
                <h3 className="text-title">No {group.toLowerCase()} events</h3>
                <p className="text-label text-text-secondary">
                  {events.length
                    ? "Choose another lifecycle tab to view your events."
                    : "Create your first event to start welcoming attendees."}
                </p>
              </div>
            )}
          </div>
        </Card>
        <p className="text-label text-text-secondary">
          Drafts appear under Upcoming. Active events are published and
          currently in progress. Completed and cancelled records remain
          available.
        </p>
      </section>
    </>
  );
}
