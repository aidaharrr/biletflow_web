"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { Badge, Button, Card, Input, Modal, Select } from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  createCampaign,
  getCampaignAnalytics,
  getCampaignQr,
  listCampaigns,
  listOrganizerEvents,
  updateCampaign,
} from "@/lib/api";
import {
  campaignStateLabel,
  campaignUrl,
  dateLabel,
  discountLabel,
  kazakhstanTime,
  localDateInput,
  parseKZT,
} from "@/lib/organizer";
import { formatKZT } from "@/lib/money";
import { useApiData } from "@/hooks/useApiData";
import type { Event, PromotionalCampaign } from "@/types/api";
import { useTranslations } from "next-intl";
import { useIntlLocale, useLabel } from "@/i18n/labels";

export function CampaignManager({
  initialEvent = "",
  createInitially = false,
}: {
  initialEvent?: string;
  createInitially?: boolean;
}) {
  const [eventId, setEventId] = useState(initialEvent);
  const t = useTranslations("campaigns");
  const tStatus = useTranslations("organizer.eventStatus");
  const load = useCallback(
    (signal: AbortSignal) => listOrganizerEvents({ signal }),
    [],
  );
  const resource = useApiData(load);
  if (resource.loading) return <LoadingSpinner label={t("loadingWorkspace")} />;
  if (resource.error || !resource.data)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  const selected =
    resource.data.find((event) => event.id === eventId) ?? resource.data[0];
  return (
    <>
      <header className="space-y-sm">
        <p className="text-label uppercase tracking-widest text-primary">
          {t("header.eyebrow")}
        </p>
        <h1 className="font-brand text-3xl font-semibold">
          {t("header.title")}
        </h1>
        <p className="text-label text-text-secondary">{t("header.subtitle")}</p>
      </header>
      {selected ? (
        <>
          <Select
            label={t("eventSelect")}
            value={selected.id}
            onChange={(event) => setEventId(event.target.value)}
          >
            {resource.data.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} ({tStatus(event.status)})
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
          <h2 className="text-title">{t("noEvents.title")}</h2>
          <p className="text-label text-text-secondary">{t("noEvents.body")}</p>
          <Link href="/organizer/events/create" className="underline">
            {t("noEvents.create")}
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
  const [editing, setEditing] = useState<PromotionalCampaign | null>(null);
  const [qr, setQr] = useState<PromotionalCampaign | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const t = useTranslations("campaigns");
  const label = useLabel();
  const locale = useIntlLocale();
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [campaigns, analytics] = await Promise.allSettled([
        listCampaigns(event.id, { signal }),
        getCampaignAnalytics(event.id, { signal }),
      ]);
      if (campaigns.status === "rejected") throw campaigns.reason;
      return {
        campaigns: campaigns.value,
        analytics:
          analytics.status === "fulfilled"
            ? new Map(analytics.value.map((row) => [row.id, row]))
            : null,
        analyticsError:
          analytics.status === "rejected" ? analytics.reason : null,
      };
    },
    [event.id],
  );
  const resource = useApiData(load);
  async function toggle(campaign: PromotionalCampaign) {
    setToggling(campaign.id);
    setActionError(null);
    try {
      await updateCampaign(event.id, campaign.id, {
        enabled: !campaign.enabled,
      });
      resource.retry();
    } catch (error) {
      setActionError(error);
    } finally {
      setToggling(null);
    }
  }
  if (resource.loading) return <LoadingSpinner label={t("loadingCampaigns")} />;
  if (resource.error || !resource.data)
    return <ErrorState error={resource.error} retry={resource.retry} />;
  const { campaigns, analytics, analyticsError } = resource.data;
  const typeName = (id: string) =>
    event.available_ticket_types.find((type) => type.id === id)?.name ??
    t("table.hiddenTicketType");
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h2 className="text-title">{event.title}</h2>
        <Button
          onClick={() => setCreating(true)}
          disabled={event.status === "cancelled"}
        >
          {t("create")}
        </Button>
      </div>
      {!!analyticsError && (
        <ErrorState error={analyticsError} retry={resource.retry} />
      )}
      {!!actionError && <ErrorState error={actionError} />}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          {campaigns.length ? (
            <table className="w-full min-w-[980px] text-left text-label">
              <thead className="border-b border-divider bg-background text-text-secondary">
                <tr>
                  {[
                    "campaign",
                    "discount",
                    "visits",
                    "redemptions",
                    "ordersTickets",
                    "revenue",
                    "actions",
                  ].map((column) => (
                    <th
                      key={column}
                      className="px-lg py-md font-medium"
                      scope="col"
                    >
                      {t(`table.columns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const stats = analytics?.get(campaign.id);
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
                              campaign.state === "active"
                                ? "success"
                                : "neutral"
                            }
                          >
                            {label(campaignStateLabel(campaign.state))}
                          </Badge>
                        </div>
                        <p className="mt-sm text-text-secondary">
                          {t("table.until", {
                            date: dateLabel(campaign.valid_until, locale),
                          })}
                        </p>
                      </td>
                      <td className="px-lg py-lg">
                        <p>{discountLabel(campaign)}</p>
                        <p className="mt-xs text-text-secondary">
                          {campaign.applicable_ticket_type_ids?.length
                            ? t("table.onTypes", {
                                types: campaign.applicable_ticket_type_ids
                                  .map(typeName)
                                  .join(", "),
                              })
                            : t("table.allPaidTickets")}
                        </p>
                      </td>
                      <td className="px-lg py-lg">{campaign.visit_count}</td>
                      <td className="px-lg py-lg">
                        {campaign.redemption_count} / {campaign.max_redemptions}
                        {campaign.held_redemptions > 0 && (
                          <p className="mt-xs text-text-secondary">
                            {t("table.inCheckout", {
                              count: campaign.held_redemptions,
                            })}
                          </p>
                        )}
                      </td>
                      <td className="px-lg py-lg">
                        {stats
                          ? `${stats.orders} / ${stats.tickets_sold}`
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-lg py-lg">
                        {stats ? (
                          <>
                            <p>{formatKZT(stats.gross_revenue_minor)}</p>
                            <p className="text-text-secondary">
                              −{formatKZT(stats.discount_minor)}
                            </p>
                            <p className="font-medium">
                              {formatKZT(stats.net_revenue_minor)}
                            </p>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-lg py-md">
                        <div className="flex flex-wrap gap-sm">
                          <Button
                            variant="outlined"
                            className="text-label"
                            onClick={() => setQr(campaign)}
                          >
                            {t("table.qrLink")}
                          </Button>
                          <Button
                            variant="text"
                            className="px-sm text-label"
                            onClick={() => setEditing(campaign)}
                          >
                            {t("table.edit")}
                          </Button>
                          <Button
                            variant="text"
                            className="px-sm text-label"
                            loading={toggling === campaign.id}
                            loadingLabel={t("table.saving")}
                            onClick={() => toggle(campaign)}
                          >
                            {campaign.enabled
                              ? t("table.disable")
                              : t("table.enable")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="space-y-md p-xl">
              <h3 className="text-title">{t("empty.title")}</h3>
              <p className="text-label text-text-secondary">
                {t("empty.body")}
              </p>
            </div>
          )}
        </div>
      </Card>
      <p className="text-label text-text-secondary">{t("footnote")}</p>
      {creating && (
        <CampaignForm
          event={event}
          onClose={() => setCreating(false)}
          onSaved={(campaign) => {
            setCreating(false);
            setQr(campaign);
            resource.retry();
          }}
        />
      )}
      {editing && (
        <CampaignForm
          event={event}
          campaign={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            resource.retry();
          }}
        />
      )}
      {qr && <CampaignQr campaign={qr} onClose={() => setQr(null)} />}
    </>
  );
}
function TicketTypeChoices({
  event,
  selected,
  disabled,
}: {
  event: Event;
  selected: string[] | null;
  disabled: boolean;
}) {
  const t = useTranslations("campaigns.form");
  const paid = event.available_ticket_types.filter(
    (type) => type.kind === "paid",
  );
  if (!paid.length) return null;
  return (
    <fieldset className="space-y-sm">
      <legend className="text-label font-medium">{t("appliesTo")}</legend>
      <p className="text-label text-text-secondary">{t("appliesToHelp")}</p>
      {paid.map((type) => (
        <label key={type.id} className="flex items-center gap-sm text-label">
          <input
            type="checkbox"
            name="types"
            value={type.id}
            defaultChecked={selected?.includes(type.id) ?? false}
            disabled={disabled}
          />
          {type.name} · {formatKZT(type.price_minor)}
        </label>
      ))}
    </fieldset>
  );
}
function CampaignForm({
  event,
  campaign,
  onClose,
  onSaved,
}: {
  event: Event;
  /** Present when editing; code and discount are fixed after creation. */
  campaign?: PromotionalCampaign;
  onClose: () => void;
  onSaved: (campaign: PromotionalCampaign) => void;
}) {
  const [kind, setKind] = useState<"percentage" | "fixed_kzt">("percentage");
  const t = useTranslations("campaigns.form");
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
      if (end <= start) throw new Error(t("errors.endBeforeStart"));
      const limit = Number(form.get("maximum"));
      if (!Number.isSafeInteger(limit) || limit < 1)
        throw new Error(t("errors.limitInvalid"));
      const types = form.getAll("types").map(String);
      const shared = {
        name: String(form.get("name")).trim(),
        valid_from: start,
        valid_until: end,
        max_redemptions: limit,
        applicable_ticket_type_ids: types.length ? types : null,
      };
      if (campaign) {
        onSaved(await updateCampaign(event.id, campaign.id, shared));
        return;
      }
      const value =
        kind === "fixed_kzt"
          ? parseKZT(String(form.get("discount")))
          : Number(form.get("discount"));
      if (
        !Number.isSafeInteger(value) ||
        value <= 0 ||
        (kind === "percentage" && value > 100)
      )
        throw new Error(t("errors.discountInvalid"));
      const body = {
        ...shared,
        code: String(form.get("code")).trim().toUpperCase(),
        discount_type: kind,
        discount_value: value,
      };
      const signature = JSON.stringify(body);
      if (request.current?.signature !== signature)
        request.current = { signature, key: crypto.randomUUID() };
      onSaved(await createCampaign(event.id, body, request.current.key));
    } catch (error) {
      setError(error);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        campaign ? t("editTitle", { code: campaign.code }) : t("createTitle")
      }
      busy={busy}
      onClose={onClose}
    >
      <p className="text-label text-text-secondary">
        {t("intro", { event: event.title })}
        {campaign &&
          ` ${t("fixedTerms", { discount: discountLabel(campaign) })}`}
      </p>
      {!!error && <ErrorState error={error} />}
      <form onSubmit={submit} className="space-y-md">
        <Input
          label={t("name")}
          name="name"
          required
          minLength={2}
          maxLength={150}
          defaultValue={campaign?.name}
          disabled={busy}
        />
        {!campaign && (
          <>
            <Input
              label={t("code")}
              name="code"
              required
              minLength={3}
              maxLength={40}
              pattern="[A-Za-z0-9_-]{3,40}"
              helperText={t("codeHelp")}
              disabled={busy}
            />
            <Select
              label={t("discountType")}
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
              disabled={busy}
            >
              <option value="percentage">{t("percentage")}</option>
              <option value="fixed_kzt">{t("fixedKzt")}</option>
            </Select>
            <Input
              key={kind}
              label={
                kind === "percentage" ? t("discountPercent") : t("discountKzt")
              }
              name="discount"
              type={kind === "percentage" ? "number" : "text"}
              inputMode="decimal"
              min={kind === "percentage" ? 1 : undefined}
              max={kind === "percentage" ? 100 : undefined}
              step={kind === "percentage" ? 1 : undefined}
              required
              disabled={busy}
            />
          </>
        )}
        <Input
          label={t("maximum")}
          name="maximum"
          type="number"
          min={
            campaign
              ? Math.max(
                  1,
                  campaign.redemption_count + campaign.held_redemptions,
                )
              : 1
          }
          step={1}
          required
          defaultValue={campaign?.max_redemptions}
          disabled={busy}
        />
        <Input
          label={t("validFrom")}
          name="from"
          type="datetime-local"
          required
          defaultValue={
            campaign ? localDateInput(campaign.valid_from) : undefined
          }
          disabled={busy}
        />
        <Input
          label={t("validUntil")}
          name="until"
          type="datetime-local"
          required
          defaultValue={
            campaign ? localDateInput(campaign.valid_until) : undefined
          }
          disabled={busy}
        />
        <TicketTypeChoices
          event={event}
          selected={campaign?.applicable_ticket_type_ids ?? null}
          disabled={busy}
        />
        <Button type="submit" loading={busy} className="w-full">
          {campaign ? t("save") : t("submitCreate")}
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
  const t = useTranslations("campaigns.qr");
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
  // The server link is what the QR image encodes; fall back for older records.
  const link =
    campaign.campaign_url ||
    (typeof window !== "undefined"
      ? campaignUrl(campaign.opaque_token, window.location.origin)
      : "");
  return (
    <Modal title={t("title")} onClose={onClose}>
      <div className="rounded-card border border-primary/30 bg-primary/5 p-md text-label">
        <strong>{t("noticeTitle")}</strong>
        <p className="mt-sm text-text-secondary">{t("noticeBody")}</p>
      </div>
      {resource.loading ? (
        <LoadingSpinner label={t("generating")} />
      ) : resource.error || !resource.data ? (
        <ErrorState error={resource.error} retry={resource.retry} />
      ) : (
        <Image
          src={resource.data}
          alt={t("alt", { code: campaign.code })}
          width={240}
          height={240}
          unoptimized
          className="mx-auto rounded-input border border-divider bg-white p-md"
        />
      )}
      <Input label={t("link")} value={link} readOnly />
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
              setError(new Error(t("copyUnavailable")));
            }
          }}
        >
          {copied ? t("copied") : t("copy")}
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
          {t("download")}
        </Button>
      </div>
    </Modal>
  );
}
