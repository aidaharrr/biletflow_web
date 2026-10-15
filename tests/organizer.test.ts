import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeCampaign,
  aggregateSummaries,
  campaignTotals,
  campaignUrl,
  eventGroup,
  filterSales,
  kazakhstanTime,
  localDateInput,
  parseKZT,
} from "../src/lib/organizer";
import {
  connectSandboxPayout,
  createApiClient,
  getManagedEvent,
  getOrganizerSummary,
  refundOrder,
  updateSupportStatus,
} from "../src/lib/api";
import type {
  Event,
  Order,
  OrganizerSummary,
  PromotionalCampaign,
} from "../src/types/api";
const now = Date.parse("2026-10-14T09:00:00Z");
test("lifecycle groups preserve draft and cancelled status despite old dates", () => {
  const event = {
    status: "published",
    starts_at: "2026-10-14T08:00:00Z",
    ends_at: "2026-10-14T12:00:00Z",
  } as Event;
  assert.equal(eventGroup(event, now), "Active");
  assert.equal(eventGroup({ ...event, status: "cancelled" }, now), "Cancelled");
  assert.equal(
    eventGroup({ ...event, ends_at: "2026-10-13T12:00:00Z" }, now),
    "Completed",
  );
  assert.equal(
    eventGroup(
      { ...event, status: "draft", ends_at: "2026-10-13T12:00:00Z" },
      now,
    ),
    "Upcoming",
  );
});
test("overview percentages weight ticket denominators rather than averaging percentages", () => {
  const totals = aggregateSummaries([
    {
      capacity: 100,
      tickets_sold: 50,
      checked_in: 10,
      gross_sales_minor: 10000,
    },
    {
      capacity: 900,
      tickets_sold: 90,
      checked_in: 60,
      gross_sales_minor: 5000,
    },
  ] as OrganizerSummary[]);
  assert.equal(totals.soldRate, 14);
  assert.equal(totals.attendanceRate, 50);
  assert.equal(totals.gross, 15000);
  assert.equal(aggregateSummaries([]).soldRate, 0);
});
test("campaign totals use confirmed attributed orders and exclude unrelated or refunded revenue", () => {
  const campaign = {
    id: "promo",
    enabled: true,
    valid_from: "2026-10-01T00:00:00Z",
    valid_until: "2026-10-31T00:00:00Z",
    redemption_count: 2,
    max_redemptions: 3,
  } as PromotionalCampaign;
  const orders = [
    {
      campaign_id: "promo",
      status: "confirmed",
      discount_minor: 1234,
      total_minor: 9876,
    },
    {
      campaign_id: "promo",
      status: "refunded",
      discount_minor: 50000,
      total_minor: 90000,
    },
    {
      campaign_id: null,
      status: "confirmed",
      discount_minor: 222,
      total_minor: 555,
    },
  ] as Order[];
  assert.deepEqual(campaignTotals(campaign, orders), {
    discount: 1234,
    revenue: 9876,
    orders: 1,
  });
  assert.equal(activeCampaign(campaign, now), true);
  assert.equal(
    activeCampaign({ ...campaign, redemption_count: 3 }, now),
    false,
  );
  assert.equal(activeCampaign({ ...campaign, enabled: false }, now), false);
  const link = new URL(
    campaignUrl("opaque-token", "https://biletflow.example"),
  );
  assert.equal(link.pathname, "/campaign/opaque-token");
  assert.equal(link.search, "");
});
test("KZT entry converts decimal strings exactly and rejects unsafe or negative values", () => {
  assert.equal(parseKZT("1500,50"), 150050);
  assert.equal(parseKZT("0.01"), 1);
  assert.equal(parseKZT("100"), 10000);
  for (const value of ["-1", "1.001", "NaN", "1e9", "999999999999999999"])
    assert.throws(() => parseKZT(value));
});
test("local Kazakhstan inputs preserve the configured offset and reject rolled-over dates", () => {
  assert.equal(kazakhstanTime("2026-10-14T18:30"), "2026-10-14T13:30:00.000Z");
  assert.equal(localDateInput("2026-10-14T13:30:00Z"), "2026-10-14T18:30");
  assert.throws(() => kazakhstanTime("2026-02-30T18:30"));
  assert.deepEqual(
    filterSales(
      [
        { date: "2026-10-13", orders: 1, revenue_minor: 100, currency: "KZT" },
        { date: "2026-10-14", orders: 2, revenue_minor: 200, currency: "KZT" },
      ],
      "2026-10-14",
      "2026-10-14",
    ).map((point) => point.orders),
    [2],
  );
});
test("managed draft lookup uses authorized organizer events rather than the public route", async () => {
  const client = createApiClient({
    fetch: async (input) => {
      assert.equal(new URL(String(input)).pathname, "/api/v1/organizer/events");
      return Response.json([
        { id: "draft", status: "draft", visibility: "private" },
      ]);
    },
  });
  assert.equal((await getManagedEvent("draft", {}, client)).status, "draft");
  await assert.rejects(getManagedEvent("foreign", {}, client), { status: 404 });
});
test("organizer mutations use existing query signatures and stable refund idempotency headers", async () => {
  const calls: { url: URL; init: RequestInit }[] = [];
  const client = createApiClient({
    fetch: async (input, init) => {
      calls.push({ url: new URL(String(input)), init: init ?? {} });
      return Response.json({});
    },
  });
  await connectSandboxPayout("DEMO-0001", client);
  await updateSupportStatus("case", "waiting_for_customer", client);
  await refundOrder("order", "Duplicate purchase", "stable-key", client);
  await getOrganizerSummary("event", {}, client);
  assert.equal(calls[0].init.method, "PUT");
  assert.equal(calls[0].url.searchParams.get("account_reference"), "DEMO-0001");
  assert.equal(calls[1].init.method, "PATCH");
  assert.equal(calls[1].url.searchParams.get("status"), "waiting_for_customer");
  assert.equal(
    new Headers(calls[2].init.headers).get("Idempotency-Key"),
    "stable-key",
  );
  assert.deepEqual(JSON.parse(String(calls[2].init.body)), {
    reason: "Duplicate purchase",
  });
  assert.equal(calls[3].url.searchParams.get("event_id"), "event");
});
