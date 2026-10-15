// Organizer fixture models implemented Python routes; absent routes deliberately return 404.
import { randomUUID, randomBytes } from "node:crypto";
export function createOrganizerFixture({
  events,
  orders,
  tickets,
  control,
  user,
  qr,
}) {
  const campaigns = [],
    cases = [],
    messages = [],
    history = [];
  let profile = null;
  const stamp = () => new Date().toISOString();
  const log = (
    event,
    action,
    description,
    entityType = "event",
    entityId = event.id,
  ) =>
    history.push({
      id: randomUUID(),
      timestamp: new Date(Date.now() + history.length).toISOString(),
      actor_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
      event_id: event.id,
    });
  const checklist = (event) => {
    const items = {
      has_paid_ticket: event.available_ticket_types.some(
        (type) => type.kind === "paid",
      ),
      identity_verified: profile?.verification_status === "verified",
      payout_connected: !!profile?.payout_verified,
      activation_fee_paid: !!event.activation_fee_paid,
      terms_accepted: !!event.terms_accepted,
    };
    return {
      status: event.paid_sales_status,
      checklist: items,
      can_activate: Object.values(items).every(Boolean),
      is_simulation: true,
    };
  };
  return function handle({ path, url, request, response, body, send }) {
    if (path === "/__organizer-seed") {
      const event = events[0];
      const campaign = {
        id: "66666666-6666-4666-8666-666666666666",
        event_id: event.id,
        name: "Campus early birds",
        code: "CAMPUS20",
        opaque_token: "fixture-opaque-campaign",
        discount_type: "percentage",
        discount_value: 20,
        valid_from: new Date(Date.now() - 86400000).toISOString(),
        valid_until: new Date(Date.now() + 86400000 * 5).toISOString(),
        max_redemptions: 100,
        redemption_count: 3,
        enabled: true,
        created_at: stamp(),
        updated_at: stamp(),
      };
      campaigns.push(campaign, {
        ...campaign,
        id: randomUUID(),
        name: "Old campaign",
        code: "OLD10",
        opaque_token: "expired-token",
        valid_until: new Date(Date.now() - 1000).toISOString(),
        redemption_count: 90,
      });
      const orderId = "77777777-7777-4777-8777-777777777777";
      const item = {
        id: randomUUID(),
        ticket_type_id: event.available_ticket_types[0].id,
        quantity: 2,
        unit_price_minor: 200000,
        discount_minor: 80000,
      };
      const issued = ["valid", "checked_in"].map((status) => ({
        id: randomUUID(),
        order_id: orderId,
        order_item_id: item.id,
        event_id: event.id,
        ticket_type_id: item.ticket_type_id,
        attendee_name: "Test Attendee",
        attendee_email: "test.attendee@example.com",
        status,
        qr_credential: "ticket.fixture",
        section: null,
        row: null,
        seat: null,
      }));
      orders.push({
        id: orderId,
        event_id: event.id,
        user_id: user.id,
        attendee_name: "Test Attendee",
        attendee_email: "test.attendee@example.com",
        status: "confirmed",
        currency: "KZT",
        subtotal_minor: 400000,
        discount_minor: 80000,
        processing_fee_minor: 9600,
        total_minor: 329600,
        campaign_id: campaign.id,
        created_at: stamp(),
        expires_at: new Date(Date.now() + 900000).toISOString(),
        items: [item],
        tickets: issued,
      });
      tickets.push(...issued);
      event.available_ticket_types[0].sold_count = 2;
      for (const [title, status, day] of [
        ["Active Fixture Event", "published", -0.1],
        ["Completed Fixture Event", "completed", -10],
        ["Cancelled Fixture Event", "cancelled", 10],
      ]) {
        const id = randomUUID();
        const copy = structuredClone(events[1]);
        copy.id = id;
        copy.title = title;
        copy.status = status;
        copy.starts_at = new Date(Date.now() + day * 86400000).toISOString();
        copy.ends_at = new Date(
          Date.parse(copy.starts_at) + 12 * 3600000,
        ).toISOString();
        copy.available_ticket_types = [
          {
            ...copy.available_ticket_types[0],
            id: randomUUID(),
            event_id: id,
            quantity: 60,
          },
        ];
        events.push(copy);
      }
      log(event, "event.published", "Event published");
      log(
        event,
        "ticket.checked_in",
        "Checked in Test Attendee",
        "ticket",
        issued[1].id,
      );
      const supportCase = {
        id: "88888888-8888-4888-8888-888888888888",
        requester_id: "99999999-9999-4999-8999-999999999999",
        event_id: event.id,
        order_id: orderId,
        ticket_id: issued[0].id,
        assigned_to: user.id,
        subject: "Question about arrival",
        category: "event_information",
        status: "open",
        created_at: stamp(),
        updated_at: stamp(),
      };
      cases.push(supportCase);
      messages.push({
        id: randomUUID(),
        case_id: supportCase.id,
        sender_id: supportCase.requester_id,
        body: "When should I arrive?",
        created_at: stamp(),
        updated_at: stamp(),
      });
      send({ ok: true });
      return true;
    }
    const relevant =
      /^(\/organizer|\/organizer-profile|\/support|\/events\/[^/]+\/(orders|history|paid-sales|campaigns|images|publish|unpublish|cancel|duplicate|ticket-types)|\/orders\/[^/]+\/refunds)$/.test(
        path,
      ) ||
      (path === "/events" && request.method === "POST") ||
      /^\/organizer\//.test(path) ||
      /^\/organizer-profile/.test(path) ||
      /^\/support\//.test(path) ||
      /^\/events\/[^/]+\/campaigns\//.test(path) ||
      /^\/events\/[^/]+\/paid-sales\//.test(path);
    if (
      !relevant ||
      (/^\/events\/[^/]+\/ticket-types$/.test(path) && request.method === "GET")
    )
      return false;
    if (request.headers.authorization !== "Bearer fixture-token") {
      send({ detail: "Not authenticated" }, 401);
      return true;
    }
    if (!user.roles.includes("organizer")) {
      send({ detail: "Organizer access required" }, 403);
      return true;
    }
    const parts = path.split("/");
    const event = events.find((event) => event.id === parts[2]);
    if (path === "/organizer/events") {
      send(events);
      return true;
    }
    if (path === "/events" && request.method === "POST") {
      const event = {
        ...body,
        id: randomUUID(),
        organizer_id: user.id,
        organizer_name: "Demo Organizer",
        venue_id: randomUUID(),
        images: [],
        status: "draft",
        available_ticket_types: [],
        paid_sales_status: "not_ready",
        created_at: stamp(),
      };
      events.push(event);
      log(event, "event.created", "Draft event created");
      send(event, 201);
      return true;
    }
    if (/^\/events\/[^/]+\/images$/.test(path)) {
      if (!control.imagesSupported) send({ detail: "Not Found" }, 404);
      else {
        event.images.push(body.url);
        send({ url: body.url }, 201);
      }
      return true;
    }
    if (
      /^\/events\/[^/]+\/ticket-types$/.test(path) &&
      request.method === "POST"
    ) {
      if (control.failTicketOnce && body.name === "VIP") {
        control.failTicketOnce = false;
        send({ detail: "Ticket save temporarily unavailable" }, 503);
        return true;
      }
      const type = {
        ...body,
        id: randomUUID(),
        event_id: event.id,
        currency: "KZT",
        reserved_count: 0,
        sold_count: 0,
        refunded_count: 0,
        is_hidden: false,
      };
      event.available_ticket_types.push(type);
      log(
        event,
        "ticket_type.created",
        `Created ${type.name}`,
        "ticket_type",
        type.id,
      );
      send(type, 201);
      return true;
    }
    if (/^\/events\/[^/]+\/(publish|unpublish|cancel|duplicate)$/.test(path)) {
      const action = parts[3];
      if (action === "duplicate") {
        const copy = {
          ...structuredClone(event),
          id: randomUUID(),
          title: `Copy of ${event.title}`,
          available_ticket_types: [],
          status: "draft",
          paid_sales_status: "not_ready",
          activation_fee_paid: false,
          terms_accepted: false,
          created_at: stamp(),
        };
        events.push(copy);
        log(copy, "event.duplicated", `Duplicated from ${event.id}`);
        send(copy, 201);
      } else {
        if (action === "cancel" && control.cancelError) {
          control.cancelError = false;
          send({ detail: "Cancellation temporarily unavailable" }, 503);
          return true;
        }
        event.status =
          action === "publish"
            ? "published"
            : action === "unpublish"
              ? "draft"
              : "cancelled";
        if (action === "cancel") event.paid_sales_status = "suspended";
        log(
          event,
          `event.${action === "publish" ? "published" : action === "unpublish" ? "unpublished" : "cancelled"}`,
          `Event ${event.status}`,
        );
        send(event);
      }
      return true;
    }
    if (path === "/organizer-profile" && request.method === "PUT") {
      profile = {
        id: randomUUID(),
        user_id: user.id,
        verification_status: "not_started",
        payout_verified: false,
        payout_account_masked: null,
        ...profile,
        ...body,
      };
      send(profile);
      return true;
    }
    if (path === "/organizer-profile/verification/submit") {
      if (!profile) send({ detail: "Create organizer profile first" }, 409);
      else {
        profile.verification_status = "verified";
        send(profile);
      }
      return true;
    }
    if (path === "/organizer-profile/payout-account") {
      if (!profile) send({ detail: "Create organizer profile first" }, 409);
      else {
        profile.payout_verified = true;
        profile.payout_account_masked = `****${url.searchParams.get("account_reference").slice(-4)}`;
        send(profile);
      }
      return true;
    }
    if (/^\/events\/[^/]+\/paid-sales/.test(path)) {
      if (request.method === "GET") {
        send(checklist(event));
        return true;
      }
      const action = parts[4];
      if (action === "accept-terms") {
        event.terms_accepted = true;
        send({ accepted: true, terms_version: "2026-09" });
      } else if (action === "activation-fee") {
        if (control.feeError) {
          control.feeError = false;
          send({ detail: "Simulated fee payment failed" }, 409);
          return true;
        }
        event.activation_fee_paid = true;
        send({
          status: "succeeded",
          amount_minor: 500000,
          currency: "KZT",
          is_simulation: true,
        });
      } else if (action === "activate") {
        if (!checklist(event).can_activate)
          send(
            { detail: "Paid-sales activation checklist is incomplete" },
            409,
          );
        else {
          event.paid_sales_status = "active";
          send({ status: "active", is_simulation: true });
        }
      } else send({ detail: "Not Found" }, 404);
      return true;
    }
    if (/^\/organizer\/analytics\//.test(path)) {
      const event = events.find(
        (event) => event.id === url.searchParams.get("event_id"),
      );
      if (!event) {
        send({ detail: "Not found" }, 404);
        return true;
      }
      const confirmed = orders.filter(
        (order) => order.event_id === event.id && order.status === "confirmed",
      );
      const issued = tickets.filter(
        (ticket) =>
          ticket.event_id === event.id &&
          ["valid", "checked_in"].includes(ticket.status),
      );
      const capacity = event.available_ticket_types.reduce(
        (sum, type) => sum + type.quantity,
        0,
      );
      const checked = issued.filter(
        (ticket) => ticket.status === "checked_in",
      ).length;
      if (parts[3] === "summary") {
        if (control.summaryError) {
          send({ detail: "Analytics temporarily unavailable" }, 503);
          return true;
        }
        send({
          event_id: event.id,
          capacity,
          tickets_sold: issued.length,
          tickets_remaining: capacity - issued.length,
          percentage_sold: capacity ? (100 * issued.length) / capacity : 0,
          gross_sales_minor: confirmed.reduce(
            (sum, order) => sum + order.subtotal_minor,
            0,
          ),
          discounts_minor: confirmed.reduce(
            (sum, order) => sum + order.discount_minor,
            0,
          ),
          refunds_minor: orders
            .filter(
              (order) =>
                order.event_id === event.id && order.status === "refunded",
            )
            .reduce((sum, order) => sum + order.total_minor, 0),
          net_revenue_minor: confirmed.reduce(
            (sum, order) => sum + order.total_minor,
            0,
          ),
          currency: "KZT",
          checked_in: checked,
          absent: issued.length - checked,
          check_in_percentage: issued.length
            ? (100 * checked) / issued.length
            : 0,
          is_simulation: true,
        });
      } else if (parts[3] === "sales-series")
        send(
          confirmed.map((order) => ({
            date: order.created_at.slice(0, 10),
            orders: 1,
            revenue_minor: order.total_minor,
            currency: "KZT",
          })),
        );
      else send({ detail: "Not Found" }, 404);
      return true;
    }
    if (/^\/events\/[^/]+\/orders$/.test(path)) {
      send(orders.filter((order) => order.event_id === event.id));
      return true;
    }
    if (/^\/events\/[^/]+\/history$/.test(path)) {
      send(history.filter((entry) => entry.event_id === event.id).reverse());
      return true;
    }
    if (/^\/events\/[^/]+\/campaigns/.test(path)) {
      if (parts[5] === "qr") {
        response.writeHead(200, { "Content-Type": "image/svg+xml" });
        response.end(qr);
      } else if (request.method === "GET")
        send(campaigns.filter((campaign) => campaign.event_id === event.id));
      else {
        const campaign = {
          ...body,
          id: randomUUID(),
          event_id: event.id,
          code: body.code.toUpperCase(),
          opaque_token: randomBytes(24).toString("base64url"),
          redemption_count: 0,
          enabled: true,
          created_at: stamp(),
          updated_at: stamp(),
        };
        campaigns.push(campaign);
        log(
          event,
          "campaign.created",
          `Campaign ${campaign.name} created`,
          "campaign",
          campaign.id,
        );
        send(campaign, 201);
      }
      return true;
    }
    if (/^\/orders\/[^/]+\/refunds$/.test(path)) {
      if (control.refundError) {
        control.refundError = false;
        send({ detail: "Refund temporarily unavailable" }, 503);
        return true;
      }
      const order = orders.find((order) => order.id === parts[2]);
      if (!order || order.status !== "confirmed") {
        send({ detail: "Only confirmed orders can be refunded" }, 409);
        return true;
      }
      order.status = "refunded";
      for (const ticket of tickets.filter(
        (ticket) => ticket.order_id === order.id,
      ))
        ticket.status = "refunded";
      const event = events.find((event) => event.id === order.event_id);
      for (const item of order.items) {
        const type = event.available_ticket_types.find(
          (type) => type.id === item.ticket_type_id,
        );
        type.sold_count -= item.quantity;
        type.refunded_count += item.quantity;
      }
      log(
        event,
        "order.refunded",
        "Full demonstration refund completed",
        "order",
        order.id,
      );
      send(
        {
          id: randomUUID(),
          status: "succeeded",
          amount_minor: order.total_minor,
          currency: "KZT",
          is_simulation: true,
        },
        201,
      );
      return true;
    }
    if (path === "/support/cases") {
      if (request.method === "GET") send(cases);
      else {
        const supportCase = {
          id: randomUUID(),
          requester_id: user.id,
          event_id: body.event_id ?? null,
          order_id: body.order_id ?? null,
          ticket_id: body.ticket_id ?? null,
          assigned_to: null,
          subject: body.subject,
          category: body.category,
          status: "open",
          created_at: stamp(),
          updated_at: stamp(),
        };
        cases.unshift(supportCase);
        messages.push({
          id: randomUUID(),
          case_id: supportCase.id,
          sender_id: user.id,
          body: body.message,
          created_at: stamp(),
          updated_at: stamp(),
        });
        send(supportCase, 201);
      }
      return true;
    }
    if (/^\/support\/cases\/[^/]+\/(messages|status)$/.test(path)) {
      const supportCase = cases.find((item) => item.id === parts[3]);
      if (!supportCase) {
        send({ detail: "Not Found" }, 404);
        return true;
      }
      if (parts[4] === "status") {
        if (supportCase.requester_id === user.id)
          send({ detail: "Only support staff can change status" }, 403);
        else {
          supportCase.status = url.searchParams.get("status");
          supportCase.updated_at = stamp();
          send(supportCase);
        }
      } else if (request.method === "GET")
        send(messages.filter((message) => message.case_id === supportCase.id));
      else if (control.replyError) {
        control.replyError = false;
        send({ detail: "Message could not be sent" }, 503);
      } else {
        const message = {
          id: randomUUID(),
          case_id: supportCase.id,
          sender_id: user.id,
          body: body.body,
          created_at: stamp(),
          updated_at: stamp(),
        };
        messages.push(message);
        supportCase.updated_at = stamp();
        send(message, 201);
      }
      return true;
    }
    return false;
  };
}
