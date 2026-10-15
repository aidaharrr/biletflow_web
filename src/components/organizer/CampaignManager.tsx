"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { Badge, Button, Card, Input, Modal, Select } from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  createCampaign,
  getCampaignQr,
  listCampaigns,
  listEventOrders,
  listOrganizerEvents,
} from "@/lib/api";
import {
  activeCampaign,
  campaignTotals,
  campaignUrl,
  dateLabel,
  kazakhstanTime,
  parseKZT,
} from "@/lib/organizer";
import { formatKZT } from "@/lib/money";
import { useApiData } from "@/hooks/useApiData";
import type { Event, PromotionalCampaign } from "@/types/api";

export function CampaignManager({
  initialEvent = "",
  createInitially = false,
}: {
  initialEvent?: string;
  createInitially?: boolean;
}) {
  const [eventId, setEventId] = useState(initialEvent);
  const load = useCallback(
    (signal: AbortSignal) => listOrganizerEvents({ signal }),
    [],
  );
  const resource = useApiData(load);
  if (resource.loading)
    return <LoadingSpinner label="Loading campaign workspace…" />;
  if (resource.error || !resource.data)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  const selected =
    resource.data.find((event) => event.id === eventId) ?? resource.data[0];
  return (
    <>
      <header className="space-y-sm">
        <p className="text-label uppercase tracking-widest text-primary">
          Turn interest into attendance
        </p>
        <h1 className="font-brand text-3xl font-semibold">Promo campaigns</h1>
        <p className="text-label text-text-secondary">
          Server-validated discounts and trackable campaign links.
        </p>
      </header>
      {selected ? (
        <>
          <Select
            label="Campaign event"
            value={selected.id}
            onChange={(event) => setEventId(event.target.value)}
          >
            {resource.data.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} ({event.status})
              </option>
            ))}
          </Select>
          <EventCampaigns
            key={selected.id}
            event={selected}
            createInitially={createInitially}
          />
        </>
      ) : (
        <Card className="space-y-md">
          <h2 className="text-title">Create an event first</h2>
          <p className="text-label text-text-secondary">
            Every campaign belongs to an event you manage.
          </p>
          <Link href="/organizer/events/create" className="underline">
            Create New Event
          </Link>
        </Card>
      )}
    </>
  );
}
function EventCampaigns({
  event,
  createInitially,
}: {
  event: Event;
  createInitially: boolean;
}) {
  const [creating, setCreating] = useState(createInitially);
  const [qr, setQr] = useState<PromotionalCampaign | null>(null);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [campaigns, orders] = await Promise.allSettled([
        listCampaigns(event.id, { signal }),
        listEventOrders(event.id, { signal }),
      ]);
      if (campaigns.status === "rejected") throw campaigns.reason;
      return {
        campaigns: campaigns.value,
        orders: orders.status === "fulfilled" ? orders.value : null,
        orderError: orders.status === "rejected" ? orders.reason : null,
        asOf: Date.now(),
      };
    },
    [event.id],
  );
  const resource = useApiData(load);
  if (resource.loading)
    return <LoadingSpinner label="Loading campaigns and attributed orders…" />;
  if (resource.error || !resource.data)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h2 className="text-title">{event.title}</h2>
        <Button
          onClick={() => setCreating(true)}
          disabled={event.status === "cancelled"}
        >
          Create Promo Campaign
        </Button>
      </div>
      {resource.data.orderError && (
        <ErrorState error={resource.data.orderError} retry={resource.retry} />
      )}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          {resource.data.campaigns.length ? (
            <table className="w-full min-w-[820px] text-left text-label">
              <thead className="border-b border-divider bg-background text-text-secondary">
                <tr>
                  {[
                    "Campaign / Code",
                    "Discount",
                    "Redemptions",
                    "Gross discount value",
                    "Attributed revenue",
                    "Campaign QR",
                  ].map((label) => (
                    <th
                      key={label}
                      className="px-lg py-md font-medium"
                      scope="col"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resource.data.campaigns.map((campaign) => {
                  const totals = resource.data!.orders
                    ? campaignTotals(campaign, resource.data!.orders)
                    : null;
                  return (
                    <tr
                      key={campaign.id}
                      className="border-b border-divider last:border-0"
                    >
                      <td className="px-lg py-lg">
                        <p className="font-medium">{campaign.name}</p>
                        <p className="mt-xs font-mono text-primary">
                          {campaign.code}
                        </p>
                        <div className="mt-sm">
                          <Badge
                            variant={
                              activeCampaign(campaign, resource.data!.asOf)
                                ? "success"
                                : "neutral"
                            }
                          >
                            {!campaign.enabled
                              ? "Disabled"
                              : campaign.redemption_count >=
                                  campaign.max_redemptions
                                ? "Exhausted"
                                : activeCampaign(campaign, resource.data!.asOf)
                                  ? "Active"
                                  : Date.parse(campaign.valid_from) >
                                      resource.data!.asOf
                                    ? "Scheduled"
                                    : "Expired"}
                          </Badge>
                        </div>
                        <p className="mt-sm text-text-secondary">
                          Until {dateLabel(campaign.valid_until)}
                        </p>
                      </td>
                      <td className="px-lg py-lg">
                        {campaign.discount_type === "percentage"
                          ? `${campaign.discount_value}%`
                          : formatKZT(campaign.discount_value)}
                      </td>
                      <td className="px-lg py-lg">
                        {campaign.redemption_count} / {campaign.max_redemptions}
                      </td>
                      <td className="whitespace-nowrap px-lg py-lg">
                        {totals ? formatKZT(totals.discount) : "—"}
                      </td>
                      <td className="whitespace-nowrap px-lg py-lg">
                        {totals ? formatKZT(totals.revenue) : "—"}
                      </td>
                      <td className="px-lg py-lg">
                        <Button
                          variant="outlined"
                          className="text-label"
                          onClick={() => setQr(campaign)}
                        >
                          Campaign QR / Link
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="space-y-md p-xl">
              <h3 className="text-title">Your first campaign starts here</h3>
              <p className="text-label text-text-secondary">
                Create a promo code with a validity window and redemption limit.
              </p>
            </div>
          )}
        </div>
      </Card>
      <p className="text-label text-text-secondary">
        Discount value and attributed revenue sum confirmed server orders only.
        Revenue includes processing fees; refunded, pending, and failed orders
        are excluded. All payments are simulated. Redemption counts come from
        the campaign record.
      </p>
      {creating && (
        <CampaignForm
          event={event}
          onClose={() => setCreating(false)}
          onCreated={(campaign) => {
            setCreating(false);
            setQr(campaign);
            resource.retry();
          }}
        />
      )}{" "}
      {qr && <CampaignQr campaign={qr} onClose={() => setQr(null)} />}
    </>
  );
}
function CampaignForm({
  event,
  onClose,
  onCreated,
}: {
  event: Event;
  onClose: () => void;
  onCreated: (campaign: PromotionalCampaign) => void;
}) {
  const [kind, setKind] = useState<"percentage" | "fixed_kzt">("percentage");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const request = useRef<{ signature: string; key: string } | null>(null);
  async function submit(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(eventSubmit.currentTarget);
      const start = kazakhstanTime(String(form.get("from")));
      const end = kazakhstanTime(String(form.get("until")));
      if (end <= start)
        throw new Error("The campaign must end after it starts.");
      const value =
        kind === "fixed_kzt"
          ? parseKZT(String(form.get("discount")))
          : Number(form.get("discount"));
      if (
        !Number.isSafeInteger(value) ||
        value <= 0 ||
        (kind === "percentage" && value > 100)
      )
        throw new Error(
          "Use a whole percentage from 1 to 100 or a positive KZT amount.",
        );
      const limit = Number(form.get("maximum"));
      if (!Number.isSafeInteger(limit) || limit < 1)
        throw new Error(
          "The redemption limit must be a positive whole number.",
        );
      const body = {
        name: String(form.get("name")).trim(),
        code: String(form.get("code")).trim().toUpperCase(),
        discount_type: kind,
        discount_value: value,
        valid_from: start,
        valid_until: end,
        max_redemptions: limit,
      };
      const signature = JSON.stringify(body);
      if (request.current?.signature !== signature)
        request.current = { signature, key: crypto.randomUUID() };
      onCreated(await createCampaign(event.id, body, request.current.key));
    } catch (error) {
      setError(error);
      setBusy(false);
    }
  }
  return (
    <Modal title="Create Promo Campaign" busy={busy} onClose={onClose}>
      <p className="text-label text-text-secondary">
        For {event.title} · Validity times use UTC+05:00.
      </p>
      {!!error && <ErrorState error={error} />}
      <form onSubmit={submit} className="space-y-md">
        <Input
          label="Campaign name"
          name="name"
          required
          maxLength={200}
          disabled={busy}
        />
        <Input
          label="Promo code"
          name="code"
          required
          minLength={3}
          maxLength={40}
          pattern="[A-Za-z0-9_-]{3,40}"
          helperText="A unique code, such as CAMPUS20."
          disabled={busy}
        />
        <Select
          label="Discount type"
          value={kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
          disabled={busy}
        >
          <option value="percentage">Percentage</option>
          <option value="fixed_kzt">Fixed KZT</option>
        </Select>
        <Input
          key={kind}
          label={kind === "percentage" ? "Discount (%)" : "Discount (KZT)"}
          name="discount"
          type={kind === "percentage" ? "number" : "text"}
          inputMode="decimal"
          min={kind === "percentage" ? 1 : undefined}
          max={kind === "percentage" ? 100 : undefined}
          step={kind === "percentage" ? 1 : undefined}
          required
          disabled={busy}
        />
        <Input
          label="Maximum redemptions"
          name="maximum"
          type="number"
          min={1}
          step={1}
          required
          disabled={busy}
        />
        <Input
          label="Valid from"
          name="from"
          type="datetime-local"
          required
          disabled={busy}
        />
        <Input
          label="Valid until"
          name="until"
          type="datetime-local"
          required
          disabled={busy}
        />
        <Button type="submit" loading={busy} className="w-full">
          Create campaign & generate link
        </Button>
      </form>
    </Modal>
  );
}
function CampaignQr({
  campaign,
  onClose,
}: {
  campaign: PromotionalCampaign;
  onClose: () => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const blob = await getCampaignQr(campaign.event_id, campaign.id, {
        signal,
      });
      signal.throwIfAborted();
      const url = URL.createObjectURL(blob);
      signal.addEventListener("abort", () => URL.revokeObjectURL(url), {
        once: true,
      });
      return url;
    },
    [campaign],
  );
  const resource = useApiData(load);
  const link =
    typeof window !== "undefined"
      ? campaignUrl(campaign.opaque_token, window.location.origin)
      : "";
  return (
    <Modal title="Campaign QR Code" onClose={onClose}>
      <div className="rounded-card border border-primary/30 bg-primary/5 p-md text-label">
        <strong>Promotional link · Not valid for admission</strong>
        <p className="mt-sm text-text-secondary">
          This code opens the event with a server-validated promotion. Admission
          requires an issued ticket.
        </p>
      </div>
      {resource.loading ? (
        <LoadingSpinner label="Generating campaign QR…" />
      ) : resource.error || !resource.data ? (
        <ErrorState error={resource.error} retry={resource.retry} />
      ) : (
        <Image
          src={resource.data}
          alt={`Campaign QR Code for ${campaign.code}, not an admission ticket`}
          width={240}
          height={240}
          unoptimized
          className="mx-auto rounded-input border border-divider bg-white p-md"
        />
      )}
      <Input label="Trackable campaign link" value={link} readOnly />
      {!!error && <ErrorState error={error} />}
      <div className="flex flex-wrap gap-md">
        <Button
          variant="outlined"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setError(null);
            } catch {
              setError(
                new Error(
                  "Copy is unavailable. Select and copy the link above.",
                ),
              );
            }
          }}
        >
          {copied ? "Link copied" : "Copy campaign link"}
        </Button>
        <Button
          disabled={!resource.data}
          onClick={() => {
            const anchor = document.createElement("a");
            anchor.href = resource.data!;
            anchor.download = `biletflow-campaign-${campaign.id}.png`;
            anchor.click();
          }}
        >
          Download Campaign QR
        </Button>
      </div>
    </Modal>
  );
}
