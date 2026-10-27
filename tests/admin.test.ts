import assert from "node:assert/strict";
import { test } from "node:test";
import { createAdminDemoApi } from "../src/lib/admin-demo";
import {
  adminHref,
  canApproveOrganizer,
  filterAdminEvents,
  hasAdminRole,
  isHiddenEvent,
  roleLabel,
} from "../src/lib/admin";
import {
  ApiError,
  createApiClient,
  getAdminDashboard,
  getPendingOrganizers,
  revokeUserAccess,
} from "../src/lib/api";
import type { User } from "../src/types/api";
const actor: User = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  email: "admin@example.com",
  full_name: "Report Admin",
  roles: ["platform_admin"],
  email_verified: true,
  is_active: true,
};
test("admin access uses the backend role and rejects inactive or ordinary accounts", () => {
  assert.equal(hasAdminRole(actor), true);
  assert.equal(roleLabel("platform_admin"), "Admin");
  assert.equal(hasAdminRole({ ...actor, roles: ["organizer"] }), false);
  assert.equal(hasAdminRole({ ...actor, is_active: false }), false);
  assert.throws(() => createAdminDemoApi({ ...actor, roles: ["attendee"] }), {
    status: 403,
  });
  assert.throws(() => createAdminDemoApi({ ...actor, is_active: false }), {
    status: 403,
  });
});
test("demo reviews retain reasons, update metrics, enforce readiness, and reset", async () => {
  const api = createAdminDemoApi(actor);
  const [ready, pending] = await api.getPendingOrganizers();
  assert.equal(canApproveOrganizer(ready), true);
  assert.equal(canApproveOrganizer(pending), false);
  await assert.rejects(api.approveOrganizer(pending.id, "not-ready"), {
    code: "APPLICATION_NOT_READY",
  });
  await api.approveOrganizer(ready.id, "approve");
  await api.rejectOrganizer(
    pending.id,
    "Sandbox payout is incomplete.",
    "reject",
  );
  assert.equal((await api.getDashboard()).pending_organizer_applications, 0);
  assert.equal(
    (await api.getOrganizerApplications()).find(
      (item) => item.id === pending.id,
    )?.rejection_reason,
    "Sandbox payout is incomplete.",
  );
  await assert.rejects(
    api.rejectOrganizer(ready.id, "Changed decision", "other"),
    { status: 409 },
  );
  api.reset();
  assert.equal((await api.getPendingOrganizers()).length, 2);
});
test("demo suspensions hide events and keep published and suspended filters distinct", async () => {
  const api = createAdminDemoApi(actor);
  const events = await api.getEvents();
  const event = events.find((event) => event.status === "published")!;
  const before = (await api.getDashboard()).active_events!;
  await api.suspendEvent(event.id, "Unverified venue information.", "suspend");
  const after = await api.getEvents();
  const hidden = after.find((item) => item.id === event.id)!;
  assert.equal(isHiddenEvent(hidden), true);
  assert.equal(hidden.suspension_reason, "Unverified venue information.");
  assert.equal((await api.getDashboard()).active_events, before - 1);
  assert.equal(
    filterAdminEvents(after, "", "published").some(
      (item) => item.id === event.id,
    ),
    false,
  );
  assert.equal(
    filterAdminEvents(after, "", "suspended").some(
      (item) => item.id === event.id,
    ),
    true,
  );
  assert.equal(
    filterAdminEvents(after, "", "draft").some((item) => item.id === event.id),
    false,
  );
});
test("demo session revocation and suspension have distinct effects and protect the acting admin", async () => {
  const api = createAdminDemoApi(actor);
  const user = (await api.getUsers()).find(
    (item) => item.email === "attendee@example.com",
  )!;
  const result = await api.revokeUserAccess(
    user.id,
    "Account access review.",
    "revoke",
  );
  assert.equal(result.revoked_sessions, 3);
  assert.equal(
    (await api.getUsers()).find((item) => item.id === user.id)?.is_active,
    true,
  );
  await api.suspendUser(user.id, "Account restriction required.", "restrict");
  assert.equal(
    (await api.getUsers()).find((item) => item.id === user.id)?.is_active,
    false,
  );
  await assert.rejects(api.suspendUser(actor.id, "Self restriction", "self"), {
    code: "SELF_RESTRICTION",
  });
  await assert.rejects(
    api.revokeUserAccess(actor.id, "Self restriction", "self-revoke"),
    { code: "SELF_RESTRICTION" },
  );
});
test("demo requests clone their data, honor cancellation, and enforce retry keys", async () => {
  const api = createAdminDemoApi(actor);
  const [application] = await api.getPendingOrganizers();
  application.applicant_name = "Changed outside the store";
  assert.notEqual(
    (await api.getPendingOrganizers())[0].applicant_name,
    application.applicant_name,
  );
  const first = await api.approveOrganizer(application.id, "same-key");
  const again = await api.approveOrganizer(application.id, "same-key");
  assert.deepEqual(first, again);
  await assert.rejects(
    api.rejectOrganizer(application.id, "Different payload", "same-key"),
    { code: "IDEMPOTENCY_CONFLICT" },
  );
  await assert.rejects(api.getUsers({ signal: AbortSignal.abort() }), {
    name: "AbortError",
  });
  await assert.rejects(api.suspendEvent("missing", "Valid reason", "missing"), {
    status: 404,
  });
});
test("missing admin APIs are explicit errors and never mask authorization or network failures", async () => {
  for (const status of [401, 403, 404, 503]) {
    const client = createApiClient({
      fetch: async () => Response.json({ detail: "Unavailable" }, { status }),
    });
    await assert.rejects(
      getPendingOrganizers({}, client),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === (status === 404 ? 501 : status),
    );
  }
  const client = createApiClient({
    fetch: async () => Response.json({ detail: "Not found" }, { status: 404 }),
  });
  await assert.rejects(
    revokeUserAccess("user", "Review sessions.", "key", client),
    { code: "ADMIN_ROUTE_NOT_IMPLEMENTED" },
  );
});
test("live metrics do not present a truncated event list or absent queues as platform totals", async () => {
  const client = createApiClient({
    fetch: async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/reports/operations"))
        return Response.json({
          users: 250,
          events: 101,
          orders: 0,
          tickets: 0,
          currency: "KZT",
          financial_data_is_simulated: true,
        });
      if (path.endsWith("/admin/events")) return Response.json([]);
      return Response.json({ detail: "Not found" }, { status: 404 });
    },
  });
  const report = await getAdminDashboard({}, client);
  assert.equal(report.total_registered_users, 250);
  assert.equal(report.active_events, null);
  assert.equal(report.pending_organizer_applications, null);
  assert.equal(report.escalated_support_cases, null);
  assert.equal(report.issues.length, 3);
});
test("admin links preserve source mode and case context without allowing external navigation", () => {
  assert.equal(
    adminHref("/admin/events?event=example#details", "demo"),
    "/admin/events?event=example&mode=demo#details",
  );
  assert.equal(adminHref("/admin/users?mode=demo", "live"), "/admin/users");
  assert.throws(() => adminHref("https://elsewhere.example/admin", "demo"));
  assert.throws(() => adminHref("/events", "demo"));
});
