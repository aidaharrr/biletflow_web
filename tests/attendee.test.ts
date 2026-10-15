import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiClient, listEvents, validatePromoCode } from "../src/lib/api";
import { generateCalendar } from "../src/lib/calendar";
import {
  filterEvents,
  priceRange,
  ticketAvailability,
} from "../src/lib/events";
import type { Event, TicketType } from "../src/types/api";

const type: TicketType = {
  id: "type",
  event_id: "event",
  name: "Standard",
  description: "",
  kind: "paid",
  price_minor: 150000,
  currency: "KZT",
  quantity: 10,
  reserved_count: 2,
  sold_count: 3,
  refunded_count: 1,
  sales_start: "2026-01-01T00:00:00Z",
  sales_end: "2026-12-31T00:00:00Z",
  max_per_order: 3,
  is_hidden: false,
};
const event: Event = {
  id: "event",
  organizer_id: "organizer",
  organizer_name: "Host",
  venue_id: "venue",
  venue: { name: "Central Hall", address: "1 Abay Street", city: "Almaty" },
  title: "Алматы, tech; meetup",
  description: "Hello\nBEGIN:VALARM\nWorld",
  category: "tech",
  images: [],
  visibility: "public",
  status: "published",
  starts_at: "2026-10-20T18:00:00+05:00",
  ends_at: "2026-10-20T20:00:00+05:00",
  time_zone: "Asia/Almaty",
  registration_opens_at: "2026-01-01T00:00:00Z",
  registration_closes_at: "2026-10-20T12:00:00Z",
  capacity: 10,
  admission_type: "general_admission",
  refund_policy: "",
  paid_sales_status: "active",
  available_ticket_types: [type],
  created_at: "2026-01-01T00:00:00Z",
};

test("discovery searches venues, matches category aliases, and hides private events", () => {
  const events = [
    event,
    { ...event, id: "private", visibility: "private" as const },
    { ...event, id: "draft", status: "draft" as const },
  ];
  assert.deepEqual(filterEvents(events, " central hall ", "Tech"), [event]);
  assert.deepEqual(filterEvents(events, "different venue", "All"), []);
  assert.equal(
    filterEvents([{ ...event, category: "music" }], "", "Concerts").length,
    1,
  );
});
test("selection respects holds, per-order limits, sales windows, and paid activation", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  assert.deepEqual(ticketAvailability(type, event, now), {
    remaining: 5,
    limit: 3,
    reason: null,
  });
  assert.equal(
    ticketAvailability({ ...type, sold_count: 8 }, event, now).reason,
    "Sold out",
  );
  assert.equal(
    ticketAvailability(type, { ...event, paid_sales_status: "suspended" }, now)
      .limit,
    0,
  );
  assert.equal(
    ticketAvailability(type, event, Date.parse("2027-01-01T00:00:00Z")).reason,
    "Registration closed",
  );
  assert.equal(priceRange([{ ...type, kind: "free", price_minor: 0 }]), "Free");
});
test("calendar exports keep absolute times, escaped text, and stable identifiers", () => {
  const calendar = generateCalendar(
    event,
    "https://biletflow.test/events/event",
    new Date("2026-10-11T10:00:00Z"),
  );
  assert.ok(calendar.includes("DTSTART:20261020T130000Z\r\n"));
  assert.ok(calendar.includes("DTEND:20261020T150000Z\r\n"));
  assert.ok(calendar.includes("X-WR-TIMEZONE:Asia/Almaty"));
  assert.ok(calendar.includes("SUMMARY:Алматы\\, tech\\; meetup"));
  assert.ok(calendar.includes("DESCRIPTION:Hello\\nBEGIN:VALARM\\nWorld"));
  assert.ok(!calendar.includes("\r\nBEGIN:VALARM"));
  assert.ok(calendar.includes("UID:event-event@biletflow.kz"));
  assert.ok(calendar.includes("URL:https://biletflow.test/events/event"));
  assert.ok(calendar.endsWith("END:VCALENDAR\r\n"));
  const cancelled = generateCalendar(
    { ...event, status: "cancelled", updated_at: "2026-10-12T00:00:00Z" },
    "https://biletflow.test/events/event",
  );
  assert.ok(cancelled.includes("UID:event-event@biletflow.kz"));
  assert.ok(cancelled.includes("STATUS:CANCELLED"));
});
test("calendar lines fold Unicode at 75 UTF-8 octets without corruption", () => {
  const title = "Қазақша концерт 🎟️ ".repeat(12);
  const calendar = generateCalendar(
    { ...event, title },
    "https://biletflow.test/events/event",
  );
  for (const line of calendar.split("\r\n"))
    assert.ok(Buffer.byteLength(line, "utf8") <= 75);
  assert.ok(calendar.replace(/\r\n /g, "").includes(`SUMMARY:${title}`));
});
test("event lists support arrays and fetch all cursor pages from the contract", async () => {
  let calls = 0;
  const client = createApiClient({
    fetch: async (input) => {
      calls++;
      const url = new URL(String(input));
      return Response.json(
        url.searchParams.get("cursor")
          ? { items: [{ ...event, id: "second" }], next_cursor: null }
          : { items: [event], next_cursor: "next" },
      );
    },
  });
  assert.deepEqual(
    (await listEvents({}, client)).map((event) => event.id),
    ["event", "second"],
  );
  assert.equal(calls, 2);
  const legacy = createApiClient({ fetch: async () => Response.json([event]) });
  assert.deepEqual(await listEvents({}, legacy), [event]);
});
test("promo quotes send IDs and quantities, never client-calculated discounts", async () => {
  const client = createApiClient({
    fetch: async (_input, init) => {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        event_id: "event",
        items: [{ ticket_type_id: "type", quantity: 2 }],
        promo_code: "SAVE20",
      });
      return Response.json({
        subtotal_minor: 300000,
        discount_minor: 60000,
        processing_fee_minor: 7200,
        total_minor: 247200,
        currency: "KZT",
        promo_code: "SAVE20",
        is_simulation: true,
      });
    },
  });
  assert.equal(
    (
      await validatePromoCode(
        "event",
        [{ ticket_type_id: "type", quantity: 2 }],
        " save20 ",
        {},
        client,
      )
    ).total_minor,
    247200,
  );
});
