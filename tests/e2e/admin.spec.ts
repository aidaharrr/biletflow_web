import { test, expect, type Page } from "@playwright/test";
const fixture = "http://127.0.0.1:8011/api/v1";
const eventId = "11111111-1111-4111-8111-111111111111";
async function login(
  page: Page,
  next = "/admin/dashboard",
  role: "admin" | "organizer" | "attendee" = "admin",
) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill(`${role}@example.com`);
  await page.getByLabel("Password").fill("DemoPass123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("link", {
      name:
        role === "admin"
          ? "Demo Admin"
          : role === "organizer"
            ? "Demo Organizer"
            : "Demo Attendee",
      exact: true,
    }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__reset`);
});
test("admin pages and APIs deny anonymous and ordinary organizer access, including demo mode", async ({
  page,
  request,
}) => {
  await page.goto("/admin/dashboard?mode=demo");
  await expect(page).toHaveURL(/\/login\?next=/);
  const anonymous = await request.get("/api/backend/admin/users");
  expect(anonymous.status()).toBe(401);
  await login(page, "/admin/dashboard?mode=demo", "organizer");
  await expect(
    page.getByText("Your account needs the Admin role to access this portal."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Admin Panel", exact: true }),
  ).toHaveCount(0);
  const blocked = await page.request.post(
    `/api/backend/admin/events/${eventId}/suspend`,
    { data: { reason: "Unauthorized request must not hide an event." } },
  );
  expect(blocked.status()).toBe(403);
  const events = await request.get(`${fixture}/events`);
  expect((await events.json()).length).toBe(2);
});
test("live metrics show unavailable queues honestly and the Navbar exposes Admin Panel only for admin", async ({
  page,
}) => {
  await login(page);
  await expect(
    page.getByRole("link", { name: "Admin Panel", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Platform overview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Some metrics are unavailable" }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Pending Organizer Applications", { exact: true })
      .locator(".."),
  ).toContainText("—");
  await expect(
    page.getByText("Escalated Support Cases", { exact: true }).locator(".."),
  ).toContainText("—");
  await expect(
    page.getByText("Demo mode — sample data", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Organizer reviews", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Organizer application review is not connected" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Use demo data", exact: true }).click();
  await expect(
    page.getByText("Demo mode — sample data", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Steppe Events", { exact: true })).toBeVisible();
});
test("demo application approvals and rejection reasons persist across navigation and reset without live mutations", async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/api/backend/admin/")
    )
      mutations.push(request.url());
  });
  await login(page, "/admin/organizers?mode=demo");
  await expect(page.getByText("Steppe Events", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-organizers.png",
    fullPage: true,
  });
  const ready = page.getByRole("row").filter({ hasText: "Steppe Events" });
  await ready.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("****1042");
  await page
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "application was approved" }),
  ).toBeVisible();
  const incomplete = page.getByRole("row").filter({ hasText: "Campus Studio" });
  await expect(
    incomplete.getByRole("button", { name: "Approve", exact: true }),
  ).toBeDisabled();
  await incomplete.getByRole("button", { name: "Reject", exact: true }).click();
  await page
    .getByLabel("Rejection reason", { exact: true })
    .fill("Sandbox payout verification is incomplete.");
  await page
    .getByRole("button", { name: "Confirm rejection", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No pending applications" }),
  ).toBeVisible();
  await page
    .getByLabel("Application status", { exact: true })
    .selectOption("rejected");
  await page
    .getByRole("button", { name: "Review details", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Sandbox payout verification is incomplete.",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/mode=demo/);
  await expect(
    page
      .getByText("Pending Organizer Applications", { exact: true })
      .locator(".."),
  ).toContainText("0");
  await page
    .getByRole("button", { name: "Reset demo data", exact: true })
    .click();
  await expect(
    page
      .getByText("Pending Organizer Applications", { exact: true })
      .locator(".."),
  ).toContainText("2");
  expect(mutations).toEqual([]);
});
test("demo event suspension hides the listing, retains its reason, and leaves live records untouched", async ({
  page,
  request,
}) => {
  await login(page, "/admin/events?mode=demo");
  await page.getByRole("button", { name: "Published", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Almaty Tech Summit" });
  await row.getByRole("button", { name: "Suspend Event", exact: true }).click();
  await page
    .getByLabel("Event suspension reason")
    .fill("Reported venue details violate platform terms.");
  await page
    .getByRole("button", { name: "Confirm event suspension", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Almaty Tech Summit" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Suspended", exact: true }).click();
  const suspended = page
    .getByRole("row")
    .filter({ hasText: "Almaty Tech Summit" });
  await expect(suspended).toContainText("Hidden from public");
  await expect(
    suspended.getByRole("button", { name: "Suspend Event", exact: true }),
  ).toBeDisabled();
  await suspended
    .getByRole("button", { name: "Review event", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Reported venue details violate platform terms.",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.screenshot({
    path: "test-results/admin-events.png",
    fullPage: true,
  });
  const live = await request.get(`${fixture}/events`);
  expect((await live.json()).length).toBe(2);
});
test("demo user management separates session revocation from account suspension and protects the acting admin", async ({
  page,
}) => {
  await login(page, "/admin/users?mode=demo");
  const self = page.getByRole("row").filter({ hasText: "admin@example.com" });
  await expect(
    self.getByRole("button", { name: "Revoke access", exact: true }),
  ).toBeDisabled();
  await expect(
    self.getByRole("button", { name: "Suspend account", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Search users by email").fill("attendee@example.com");
  await page.getByRole("button", { name: "Search users", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "attendee@example.com" });
  await row.getByRole("button", { name: "Revoke access", exact: true }).click();
  await page
    .getByLabel("Access revocation reason")
    .fill("Review requested for existing sessions.");
  await page
    .getByRole("button", { name: "Confirm access revocation", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "3 active session(s) revoked" }),
  ).toBeVisible();
  await expect(row).toContainText("Active");
  await row.getByRole("button", { name: "View user", exact: true }).click();
  await expect(
    page.getByText("Active sessions", { exact: true }).locator(".."),
  ).toContainText("0");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await row
    .getByRole("button", { name: "Suspend account", exact: true })
    .click();
  await page
    .getByLabel("Account suspension reason")
    .fill("Account activity requires restriction.");
  await page
    .getByRole("button", { name: "Confirm account suspension", exact: true })
    .click();
  await expect(row).toContainText("Suspended");
  await expect(
    row.getByRole("button", { name: "Revoke access", exact: true }),
  ).toBeDisabled();
});
test("live suspension reports a partial outcome and retry completes hiding plus paid-sales suspension", async ({
  page,
  request,
}) => {
  await login(page, "/admin/events");
  await page.getByRole("button", { name: "Published", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Almaty Tech Meetup" });
  await row.getByRole("button", { name: "Suspend Event", exact: true }).click();
  await page
    .getByLabel("Event suspension reason")
    .fill("Reported listing needs moderation.");
  await request.post(`${fixture}/__control`, {
    data: { adminSuspendError: true },
  });
  await page
    .getByRole("button", { name: "Confirm event suspension", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "event was hidden",
  );
  await expect(page.getByLabel("Event suspension reason")).toHaveValue(
    "Reported listing needs moderation.",
  );
  const hidden = await request.get(`${fixture}/events`);
  expect(
    (await hidden.json()).some((event: { id: string }) => event.id === eventId),
  ).toBe(false);
  await page
    .getByRole("button", { name: "Confirm event suspension", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Suspended", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Almaty Tech Meetup" }),
  ).toContainText("Hidden from public");
});
test("live session revocation remains an explicit error while supported account suspension works", async ({
  page,
}) => {
  await login(page, "/admin/users");
  await page.getByLabel("Search users by email").fill("target@example.com");
  await page.getByRole("button", { name: "Search users", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "target@example.com" });
  await row.getByRole("button", { name: "Revoke access", exact: true }).click();
  await page
    .getByLabel("Access revocation reason")
    .fill("Review active sessions.");
  await page
    .getByRole("button", { name: "Confirm access revocation", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Session revocation is not connected",
  );
  await expect(
    page.getByText("Demo mode — sample data", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await row
    .getByRole("button", { name: "Suspend account", exact: true })
    .click();
  await page
    .getByLabel("Account suspension reason")
    .fill("Platform access restricted after review.");
  await page
    .getByRole("button", { name: "Confirm account suspension", exact: true })
    .click();
  await expect(row).toContainText("Suspended");
});
test("report dashboard, moderation queues, and review modals fit mobile", async ({
  page,
}) => {
  await login(page, "/admin/dashboard?mode=demo");
  await expect(
    page.getByRole("heading", { name: "Platform overview" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/admin-dashboard.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/admin-dashboard-mobile.png",
    fullPage: true,
  });
  for (const [label, title] of [
    ["Organizer reviews", "Organizer applications"],
    ["Event moderation", "Event moderation"],
    ["User management", "User management"],
  ]) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("link", { name: "Organizer reviews", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reject", exact: true })
    .first()
    .click();
  const modal = (await page.getByRole("dialog").boundingBox())!;
  expect(modal.width).toBeGreaterThan(300);
  expect(modal.x + modal.width).toBeLessThanOrEqual(375);
  await page.screenshot({ path: "test-results/admin-review-mobile.png" });
});
