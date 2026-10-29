import { formatKZT } from "./money";
import type {
  CampaignState,
  Event,
  OrganizerSummary,
  PromotionalCampaign,
  SalesPoint,
} from "@/types/api";

export const eventGroups = [
  "Upcoming",
  "Active",
  "Completed",
  "Cancelled",
] as const;
export type EventGroup = (typeof eventGroups)[number];
export function eventGroup(event: Event, now = Date.now()): EventGroup {
  if (event.status === "cancelled") return "Cancelled";
  if (
    event.status === "completed" ||
    (event.status !== "draft" && Date.parse(event.ends_at) <= now)
  )
    return "Completed";
  if (event.status === "published" && Date.parse(event.starts_at) <= now)
    return "Active";
  return "Upcoming";
}
export const percentage = (value: number, total: number) =>
  total > 0 ? (value * 100) / total : 0;
export const percentText = (value: number) =>
  `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value)}%`;
export function aggregateSummaries(rows: OrganizerSummary[]) {
  const capacity = rows.reduce((sum, row) => sum + row.capacity, 0);
  const sold = rows.reduce((sum, row) => sum + row.tickets_sold, 0);
  const checked = rows.reduce((sum, row) => sum + row.checked_in, 0);
  return {
    capacity,
    sold,
    checked,
    gross: rows.reduce((sum, row) => sum + row.gross_sales_minor, 0),
    soldRate: percentage(sold, capacity),
    attendanceRate: percentage(checked, sold),
  };
}
export function campaignStateLabel(state: CampaignState | "event_cancelled") {
  return {
    active: "Active",
    scheduled: "Scheduled",
    expired: "Expired",
    exhausted: "Exhausted",
    disabled: "Disabled",
    event_cancelled: "Event cancelled",
  }[state];
}
export function discountLabel(
  campaign: Pick<PromotionalCampaign, "discount_type" | "discount_value">,
) {
  return campaign.discount_type === "percentage"
    ? `${campaign.discount_value}%`
    : formatKZT(campaign.discount_value);
}
export function activeCampaign(
  campaign: PromotionalCampaign,
  now = Date.now(),
) {
  return (
    campaign.enabled &&
    Date.parse(campaign.valid_from) <= now &&
    Date.parse(campaign.valid_until) > now &&
    campaign.redemption_count < campaign.max_redemptions
  );
}
export function parseKZT(value: string): number {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter a KZT amount with up to two decimal places.");
  const [major, decimal = ""] = value.trim().replace(",", ".").split(".");
  const amount = Number(major) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount))
    throw new Error("This amount is too large.");
  return amount;
}
/** Kazakhstan local inputs use an explicit offset, independent of the browser's zone. */
export function kazakhstanTime(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Enter a valid date and time.");
  const date = new Date(`${value}:00+05:00`);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Enter a valid date and time.");
  if (localDateInput(date.toISOString()) !== value)
    throw new Error("Enter a valid calendar date and time.");
  return date.toISOString();
}
export function localDateInput(value: string): string {
  return new Date(Date.parse(value) + 5 * 3600000).toISOString().slice(0, 16);
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Almaty",
  }).format(new Date(value));
}
export function filterSales(rows: SalesPoint[], from: string, to: string) {
  return rows.filter(
    (row) => (!from || row.date >= from) && (!to || row.date <= to),
  );
}
export function campaignUrl(token: string, origin: string) {
  return new URL(`/campaign/${encodeURIComponent(token)}`, origin).href;
}
