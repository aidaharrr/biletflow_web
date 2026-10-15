// This fixture is used only by Playwright; the production app has no demo-data fallback.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createOrganizerFixture } from "./mock-organizer.mjs";

const paidId = "11111111-1111-4111-8111-111111111111";
const freeId = "22222222-2222-4222-8222-222222222222";
const paidTypeId = "33333333-3333-4333-8333-333333333333";
const freeTypeId = "44444444-4444-4444-8444-444444444444";
const user = {
  id: "55555555-5555-4555-8555-555555555555",
  email: "attendee@example.com",
  full_name: "Demo Attendee",
  email_verified: true,
  roles: ["attendee"],
};
let events;
let orders;
let tickets;
let control;
let organizer;

function reset() {
  user.email = "attendee@example.com";
  user.full_name = "Demo Attendee";
  user.roles = ["attendee"];
  const now = Date.now();
  const starts = new Date(now + 7 * 86400000).toISOString();
  const before = new Date(now - 86400000).toISOString();
  const closes = new Date(now + 6 * 86400000).toISOString();
  const type = (id, eventId, free) => ({
    id,
    event_id: eventId,
    name: free ? "Free admission" : "General admission",
    description: "Includes entry to the event.",
    kind: free ? "free" : "paid",
    price_minor: free ? 0 : 200000,
    currency: "KZT",
    quantity: 20,
    reserved_count: 0,
    sold_count: 0,
    refunded_count: 0,
    sales_start: before,
    sales_end: closes,
    max_per_order: 3,
    is_hidden: false,
  });
  const event = (id, title, category, venue, ticketType) => ({
    id,
    organizer_id: user.id,
    organizer_name: "Community Events",
    venue_id: randomUUID(),
    venue: { name: venue, address: "10 Abay Avenue", city: "Almaty" },
    title,
    description: "An event for the community. Meet new people and share ideas.",
    category,
    images: ["http://127.0.0.1:8011/banner.svg"],
    visibility: "public",
    status: "published",
    starts_at: starts,
    ends_at: new Date(now + 7 * 86400000 + 7200000).toISOString(),
    time_zone: "Asia/Almaty",
    registration_opens_at: before,
    registration_closes_at: closes,
    capacity: 20,
    admission_type: "general_admission",
    refund_policy: "Contact your organizer for refunds.",
    paid_sales_status: "active",
    available_ticket_types: [ticketType],
    created_at: before,
  });
  events = [
    event(
      paidId,
      "Almaty Tech Meetup",
      "tech",
      "Central Hub",
      type(paidTypeId, paidId, false),
    ),
    event(
      freeId,
      "Student Community Day",
      "student",
      "Campus Hall",
      type(freeTypeId, freeId, true),
    ),
  ];
  orders = [];
  tickets = [];
  control = {};
  organizer = createOrganizerFixture({
    events,
    orders,
    tickets,
    control,
    user,
    qr: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="white"/><path d="M16 16h64v64H16zM152 16h64v64h-64zM16 152h64v64H16zM96 96h24v24H96z" fill="black"/></svg>',
  });
}
reset();
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#f0534f"/><circle cx="460" cy="30" r="170" fill="#1d1d1d" opacity=".12"/><text x="40" y="170" font-family="Arial" font-size="36" fill="white">BiletFlow test event</text></svg>';
const qr =
  '<svg xmlns="http://www.w3.org/2000/svg" width="232" height="232"><rect width="232" height="232" fill="white"/><path d="M16 16h64v64H16zM152 16h64v64h-64zM16 152h64v64H16z" fill="black"/><path d="M96 96h24v24H96zM128 128h24v24h-24zM160 96h24v24h-24z" fill="black"/></svg>';

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:8011");
  const path = url.pathname.replace(/^\/api\/v1/, "");
  const send = (body, status = 200) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  };
  let body = {};
  if (["POST", "PUT", "PATCH"].includes(request.method)) {
    let raw = "";
    for await (const part of request) raw += part;
    body = raw ? JSON.parse(raw) : {};
  }
  if (path === "/__reset") {
    reset();
    return send({ ok: true });
  }
  if (path === "/__control") {
    Object.assign(control, body);
    return send({ ok: true });
  }
  if (path === "/health") return send({ status: "ok" });
  if (path === "/banner.svg") {
    response.writeHead(200, { "Content-Type": "image/svg+xml" });
    return response.end(svg);
  }
  if (path === "/auth/register") {
    user.email = body.email;
    user.full_name = body.full_name;
    return send(user, 201);
  }
  if (path === "/auth/login") {
    if (body.password === "wrong")
      return send({ detail: "Invalid email or password" }, 401);
    if (body.email === "organizer@example.com") {
      user.email = body.email;
      user.full_name = "Demo Organizer";
      user.roles = ["attendee", "organizer"];
    }
    return send({
      access_token: "fixture-token",
      expires_in: 1800,
      token_type: "bearer",
      user,
    });
  }
  const protectedRoute = /^\/(users|orders|tickets|checkout|promo-codes)/.test(
    path,
  );
  if (
    protectedRoute &&
    request.headers.authorization !== "Bearer fixture-token"
  )
    return send({ detail: "Not authenticated" }, 401);
  if (path === "/users/me") return send(user);
  if (organizer({ path, url, request, response, body, send })) return;
  if (/^\/events\/[^/]+$/.test(path) && request.method === "PATCH") {
    const event = events.find((event) => event.id === path.split("/")[2]);
    if (!event) return send({ detail: "Not Found" }, 404);
    Object.assign(event, body);
    return send(event);
  }
  if (path === "/campaigns/resolve/offer")
    return send({ event_id: paidId, promo_code: "SAVE20" });
  if (path === "/events") {
    if (control.eventError) {
      control.eventError = false;
      return send(
        {
          error: {
            code: "UNAVAILABLE",
            message: "Events are temporarily unavailable.",
            details: {},
          },
        },
        503,
      );
    }
    return send(
      events.filter(
        (event) =>
          event.status === "published" && event.visibility === "public",
      ),
    );
  }
  const eventMatch = path.match(/^\/events\/([^/]+)(\/ticket-types)?$/);
  if (eventMatch) {
    const event = events.find((event) => event.id === eventMatch[1]);
    if (!event) return send({ detail: "Not found" }, 404);
    return send(eventMatch[2] ? event.available_ticket_types : event);
  }
  if (path === "/orders" && request.method === "GET") return send(orders);
  if (path === "/tickets" && request.method === "GET")
    return send(
      control.orderDetailsMissing
        ? tickets.map((ticket) => {
            const summary = { ...ticket };
            delete summary.order_id;
            delete summary.order_item_id;
            return summary;
          })
        : tickets,
    );
  const order = orders.find((order) => path === `/orders/${order.id}`);
  if (order) {
    if (control.orderDetailsMissing) {
      const summary = { ...order };
      delete summary.items;
      delete summary.tickets;
      return send(summary);
    }
    return send(order);
  }
  const file = path.match(/^\/tickets\/([^/]+)\/(qr|pdf)$/);
  if (file) {
    if (!tickets.some((ticket) => ticket.id === file[1]))
      return send({ detail: "Not found" }, 404);
    response.writeHead(200, {
      "Content-Type": file[2] === "qr" ? "image/svg+xml" : "application/pdf",
    });
    return response.end(
      file[2] === "qr" ? qr : "%PDF-1.4\nTest fixture PDF\n%%EOF",
    );
  }
  if (path === "/promo-codes/validate" || path === "/checkout/sessions") {
    if (path === "/promo-codes/validate" && control.quoteMissing)
      return send({ detail: "Not Found" }, 404);
    const event = events.find((event) => event.id === body.event_id);
    if (!event) return send({ detail: "Not found" }, 404);
    if (control.soldOut)
      return send(
        {
          error: {
            code: "TICKET_INVENTORY_EXHAUSTED",
            message: "The selected ticket type is sold out.",
            details: {},
          },
        },
        409,
      );
    if (body.promo_code && body.promo_code !== "SAVE20")
      return send(
        { detail: "Promo code is invalid, expired, or exhausted" },
        409,
      );
    const subtotal = body.items.reduce(
      (sum, item) =>
        sum +
        event.available_ticket_types.find(
          (type) => type.id === item.ticket_type_id,
        ).price_minor *
          item.quantity,
      0,
    );
    const discount = body.promo_code ? Math.floor(subtotal * 0.2) : 0;
    const fee = Math.floor((subtotal - discount) * 0.03);
    const totals = {
      subtotal_minor: subtotal,
      discount_minor: discount,
      processing_fee_minor: fee,
      total_minor: subtotal - discount + fee,
      currency: "KZT",
      promo_code: body.promo_code || null,
      is_simulation: true,
    };
    if (path === "/promo-codes/validate") return send(totals);
    const order = {
      ...totals,
      id: randomUUID(),
      event_id: event.id,
      user_id: user.id,
      attendee_name: body.attendee_name,
      attendee_email: body.attendee_email,
      status: "pending",
      expires_at: new Date(
        Date.now() + (control.expired ? -1000 : 900000),
      ).toISOString(),
      campaign_id: body.promo_code ? randomUUID() : null,
      created_at: new Date().toISOString(),
      tickets: [],
      items: body.items.map((item) => ({
        id: randomUUID(),
        ...item,
        unit_price_minor: event.available_ticket_types.find(
          (type) => type.id === item.ticket_type_id,
        ).price_minor,
        discount_minor: 0,
      })),
    };
    orders.push(order);
    return send(order, 201);
  }
  const completion = path.match(/^\/checkout\/sessions\/([^/]+)\/complete$/);
  if (completion) {
    const order = orders.find((order) => order.id === completion[1]);
    if (!order) return send({ detail: "Not found" }, 404);
    if (order.status === "confirmed") return send(order);
    if (Date.parse(order.expires_at) <= Date.now())
      return send({ detail: "Checkout session expired or closed" }, 409);
    if (control.paymentError) {
      order.status = "payment_failed";
      return send(
        { detail: "Demo payment failed. No tickets were issued." },
        409,
      );
    }
    order.status = "confirmed";
    order.tickets = order.items.flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        id: randomUUID(),
        order_id: order.id,
        order_item_id: item.id,
        event_id: order.event_id,
        ticket_type_id: item.ticket_type_id,
        attendee_name: order.attendee_name,
        attendee_email: order.attendee_email,
        status: "valid",
        qr_credential: "ticket.test-fixture",
        section: null,
        row: null,
        seat: null,
      })),
    );
    tickets.push(...order.tickets);
    return send(order);
  }
  return send({ detail: "Not found" }, 404);
});
server.listen(8011, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.close(() => process.exit(0)));
