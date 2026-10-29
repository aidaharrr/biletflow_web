import { test, expect, type Page } from "@playwright/test";
const fixture = "http://127.0.0.1:8011/api/v1";
const paidId = "11111111-1111-4111-8111-111111111111";
const orderId = "77777777-7777-4777-8777-777777777777";
async function login(
  page: Page,
  next = "/organizer/dashboard",
  organizer = true,
) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page
    .getByLabel("Email", { exact: true })
    .fill(organizer ? "organizer@example.com" : "attendee@example.com");
  await page.getByLabel("Password").fill("DemoPass123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("link", {
      name: organizer ? "Demo Organizer" : "Demo Attendee",
      exact: true,
    }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__reset`);
});
test("organizer pages reject anonymous and attendee-only sessions", async ({
  page,
}) => {
  await page.goto("/organizer/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
  await login(page, "/organizer/dashboard", false);
  await expect(
    page.getByRole("heading", { name: "Organizer access required" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dashboard overview" }),
  ).toHaveCount(0);
});
test("overview aggregates real metrics, groups history, and confirms cancellation with retry", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__organizer-seed`);
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Dashboard overview" }),
  ).toBeVisible();
  await expect(page.getByText("50%", { exact: true })).toBeVisible();
  await expect(page.getByText("3", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/organizer-dashboard.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Active (1)" }).click();
  await expect(
    page.getByRole("link", { name: "Active Fixture Event", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Completed (1)" }).click();
  await expect(
    page.getByRole("link", { name: "Completed Fixture Event", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Upcoming (2)" }).click();
  const row = page.getByRole("row").filter({
    has: page.getByRole("link", { name: "Almaty Tech Meetup", exact: true }),
  });
  await row.getByRole("button", { name: "Cancel Event", exact: true }).click();
  await page
    .getByLabel("Cancellation reason")
    .fill("The venue is unavailable.");
  await request.post(`${fixture}/__control`, { data: { cancelError: true } });
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Cancellation temporarily unavailable",
  );
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: "Cancelled (2)" }).click();
  await expect(
    page.getByRole("link", { name: "Almaty Tech Meetup", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/organizer-dashboard-mobile.png",
    fullPage: true,
  });
});
test("duplicating an event opens a configuration draft without transactions", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__organizer-seed`);
  await login(page);
  const row = page.getByRole("row").filter({
    has: page.getByRole("link", { name: "Almaty Tech Meetup", exact: true }),
  });
  await row.getByRole("button", { name: "Duplicate Event" }).click();
  await expect(
    page.getByRole("heading", { name: "Complete your event draft" }),
  ).toBeVisible();
  await expect(page.getByLabel("Event title")).toHaveValue(
    "Copy of Almaty Tech Meetup",
  );
  const id = new URL(page.url()).searchParams.get("draft")!;
  const response = await request.get(`${fixture}/events/${id}/orders`, {
    headers: { Authorization: "Bearer fixture-token" },
  });
  expect(await response.json()).toEqual([]);
  await page.getByRole("button", { name: "Save details & continue" }).click();
  await expect(page.getByLabel("Ticket 1 name")).toHaveValue(
    "General admission",
  );
  await expect(page.getByLabel("Ticket 1 quantity")).toHaveValue("20");
  await expect(page.getByText("Saved", { exact: true })).toHaveCount(0);
});
test("wizard recovers from missing banners and partial ticket saves, then activates and publishes paid sales", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  await login(page, "/organizer/events/create");
  const format = (days: number, hours = 0) =>
    new Date(Date.now() + days * 86400000 + hours * 3600000 + 5 * 3600000)
      .toISOString()
      .slice(0, 16);
  await page.getByLabel("Event title").fill("Portal Launch Event");
  await page
    .getByLabel("Banner image URL (optional)")
    .fill("http://127.0.0.1:8011/banner.svg");
  await page
    .getByLabel("Event description")
    .fill("An event created through the organizer portal.");
  await page.getByLabel("Event starts", { exact: true }).fill(format(10));
  await page.getByLabel("Event ends", { exact: true }).fill(format(10, 2));
  await page.getByLabel("Registration opens").fill(format(-1));
  await page.getByLabel("Registration closes").fill(format(9));
  await page.getByLabel("Venue name").fill("Launch Hall");
  await page.getByLabel("Venue address").fill("10 Abay Avenue");
  await page.getByLabel("Event capacity").fill("20");
  await page.getByRole("button", { name: "Save details & continue" }).click();
  await expect(
    page.getByText(
      "Your event draft is saved, but the banner could not be attached.",
      { exact: false },
    ),
  ).toBeVisible();
  const id = new URL(page.url()).searchParams.get("draft")!;
  expect(id).toBeTruthy();
  await page.getByRole("button", { name: "Continue without banner" }).click();
  await page.getByLabel("Ticket 1 quantity").fill("10");
  await page.getByRole("button", { name: "Add ticket type" }).click();
  await page.getByLabel("Ticket 2 name").fill("VIP");
  await page.getByLabel("Ticket 2 price (KZT)").fill("2500.50");
  await page.getByLabel("Ticket 2 quantity").fill("10");
  await request.post(`${fixture}/__control`, {
    data: { failTicketOnce: true },
  });
  await page.getByRole("button", { name: "Save tickets & continue" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Ticket save temporarily unavailable" }),
  ).toBeVisible();
  await expect(page.getByLabel("Ticket 1 name")).toBeDisabled();
  await page.getByRole("button", { name: "Save tickets & continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Paid sales activation checklist" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish event", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Organizer contact name").fill("Demo Organizer");
  await page.getByRole("button", { name: "Verify sandbox identity" }).click();
  await page.getByLabel("Sandbox payout reference").fill("DEMO-0001");
  await page.getByRole("button", { name: "Connect sandbox payout" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Accept paid-event terms" }).click();
  await request.post(`${fixture}/__control`, { data: { feeError: true } });
  await page
    .getByRole("button", { name: "Pay simulated activation fee" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Simulated fee payment failed" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pay simulated activation fee" })
    .click();
  await page
    .getByRole("button", { name: "Activate paid sales for this event" })
    .click();
  await expect(
    page.getByRole("button", { name: "Publish event", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Publish event", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/organizer/events/${id}$`));
  await expect(
    page.getByRole("heading", { name: "Portal Launch Event", exact: true }),
  ).toBeVisible();
  const managed = await request.get(`${fixture}/organizer/events`, {
    headers: { Authorization: "Bearer fixture-token" },
  });
  const event = (await managed.json()).find(
    (event: { id: string }) => event.id === id,
  );
  expect(event.available_ticket_types).toHaveLength(2);
  expect(event.available_ticket_types[1].price_minor).toBe(250050);
  expect(event.paid_sales_status).toBe("active");
  expect(event.status).toBe("published");
});
test("campaigns report confirmed order values and generate an opaque promotional QR link", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__organizer-seed`);
  await login(page, `/organizer/campaigns?event=${paidId}`);
  await expect(
    page.getByText("Campus early birds", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("800,00", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "Create Promo Campaign", exact: true })
    .click();
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("Fixed Launch Promo");
  await page.getByLabel("Promo code", { exact: true }).fill("launch15");
  await page.getByLabel("Discount type").selectOption("fixed_kzt");
  await page.getByLabel("Discount (KZT)").fill("1500.50");
  await page.getByLabel("Maximum redemptions").fill("20");
  const date = (days: number) =>
    new Date(Date.now() + days * 86400000 + 5 * 3600000)
      .toISOString()
      .slice(0, 16);
  await page.getByLabel("Valid from").fill(date(-1));
  await page.getByLabel("Valid until").fill(date(5));
  await page
    .getByRole("button", { name: "Create campaign & generate link" })
    .click();
  await expect(
    page.getByRole("img", {
      name: "Campaign QR Code for LAUNCH15, not an admission ticket",
    }),
  ).toBeVisible();
  const link = new URL(
    await page.getByLabel("Trackable campaign link").inputValue(),
  );
  expect(link.pathname).toMatch(/^\/campaign\/[A-Za-z0-9_-]+$/);
  expect(link.search).toBe("");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Campaign QR", exact: true })
    .click();
  expect((await download).suggestedFilename()).toMatch(
    /^biletflow-campaign-.+\.png$/,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  const row = page.getByRole("row", { name: /LAUNCH15/ });
  await row.getByRole("button", { name: "Disable" }).click();
  await expect(row.getByText("Disabled", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Maximum redemptions").fill("40");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(row).toContainText("0 / 40");
  const response = await request.get(`${fixture}/events/${paidId}/campaigns`, {
    headers: { Authorization: "Bearer fixture-token" },
  });
  expect(
    (await response.json()).find(
      (campaign: { code: string }) => campaign.code === "LAUNCH15",
    ).discount_value,
  ).toBe(150050);
  await page.screenshot({
    path: "test-results/organizer-campaigns.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("analytics shows unavailable revenue honestly and retries a full refund with refreshed history", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__organizer-seed`);
  await login(page, `/organizer/events/${paidId}`);
  await expect(
    page.getByText("historical revenue is not estimated", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Search attendees").fill("test.attendee@example.com");
  await expect(page.getByText("Test Attendee", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/organizer-analytics.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: `Refund order ${orderId.slice(0, 8)}` })
    .click();
  await page.getByLabel("Refund reason").fill("Attendee requested a refund.");
  await request.post(`${fixture}/__control`, { data: { refundError: true } });
  await page.getByRole("button", { name: "Confirm full refund" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Refund temporarily unavailable",
  );
  await page.getByRole("button", { name: "Confirm full refund" }).click();
  await expect(
    page.getByText("Full demonstration refund completed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Refund order ${orderId.slice(0, 8)}` }),
  ).toBeDisabled();
  const orders = await request.get(`${fixture}/events/${paidId}/orders`, {
    headers: { Authorization: "Bearer fixture-token" },
  });
  expect(
    (await orders.json())[0].tickets.every(
      (ticket: { status: string }) => ticket.status === "refunded",
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/organizer-analytics-mobile.png",
    fullPage: true,
  });
});
test("support keeps unsent replies during refresh, retries failed messages, and updates case status", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__organizer-seed`);
  await login(page, "/organizer/support");
  await expect(
    page.getByText("When should I arrive?", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Reply to support case")
    .fill("Please arrive thirty minutes before the start.");
  await page.getByRole("button", { name: "Refresh inbox" }).click();
  await expect(page.getByLabel("Reply to support case")).toHaveValue(
    "Please arrive thirty minutes before the start.",
  );
  await request.post(`${fixture}/__control`, { data: { replyError: true } });
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Message could not be sent" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(
    page.getByText("Please arrive thirty minutes before the start.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Update case status")
    .selectOption("waiting_for_customer");
  await page
    .getByRole("button", { name: "Update status", exact: true })
    .click();
  await expect(
    page.getByText("Waiting for Customer", { exact: true }),
  ).toHaveCount(2);
  await page.screenshot({
    path: "test-results/organizer-support.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Contact platform support", exact: true })
    .click();
  await page.getByLabel("Support subject").fill("Sandbox activation help");
  await page
    .getByLabel("Describe your issue")
    .fill("Please explain the sandbox fee.");
  await page.getByRole("button", { name: "Open support case" }).click();
  await expect(
    page.getByRole("heading", { name: "Sandbox activation help", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Platform staff manage the status of your own support requests.",
    ),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/organizer-support-mobile.png",
    fullPage: true,
  });
});

test("failed analytics keep event actions available and never display partial totals", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__organizer-seed`);
  await request.post(`${fixture}/__control`, { data: { summaryError: true } });
  await login(page);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Analytics temporarily unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByText("Total Gross Sales", { exact: true }).locator(".."),
  ).toContainText("—");
  await expect(page.getByText("4 000,00", { exact: false })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Almaty Tech Meetup", exact: true }),
  ).toBeVisible();
  await request.post(`${fixture}/__control`, { data: { summaryError: false } });
  await page.getByRole("button", { name: "Refresh overview" }).click();
  await expect(page.getByText("50%", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Upcoming (2)" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Active (1)" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("link", { name: "Active Fixture Event", exact: true }),
  ).toBeVisible();
});
