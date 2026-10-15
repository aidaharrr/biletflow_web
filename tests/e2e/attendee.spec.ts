import { test, expect, type Page } from "@playwright/test";

const paidId = "11111111-1111-4111-8111-111111111111";
const freeId = "22222222-2222-4222-8222-222222222222";
const fixture = "http://127.0.0.1:8011/api/v1";
async function login(page: Page, next = "/events") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill("attendee@example.com");
  await page.getByLabel("Password").fill("DemoPass123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Demo Attendee", exact: true }),
  ).toBeVisible();
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__reset`);
});

test("discovery filters by venue and category, recovers from failure, and fits mobile", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__control`, { data: { eventError: true } });
  await page.goto("/events");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Events are temporarily unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Almaty Tech Meetup" }),
  ).toBeVisible();
  expect(
    (await page.getByLabel("Search events").boundingBox())!.width,
  ).toBeGreaterThan(500);
  await page.getByLabel("Search events").fill("Campus Hall");
  await expect(
    page.getByRole("heading", { name: "Student Community Day" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Almaty Tech Meetup" }),
  ).toHaveCount(0);
  await page.getByLabel("Search events").fill("");
  await page.getByRole("button", { name: "Tech", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Student Community Day" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.screenshot({
    path: "test-results/attendee-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    (await page.getByLabel("Search events").boundingBox())!.width,
  ).toBeGreaterThan(300);
  await expect(
    page.getByRole("link", { name: "My Tickets", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/attendee-mobile.png",
    fullPage: true,
  });
});

test("anonymous ticket selection survives sign-in, and free checkout issues a canonical ticket", async ({
  page,
  context,
}) => {
  await page.goto(`/events/${freeId}`);
  await page.getByRole("button", { name: "Add Free admission ticket" }).click();
  await page.getByRole("link", { name: "Sign in to checkout" }).click();
  await page.getByLabel("Email", { exact: true }).fill("attendee@example.com");
  await page.getByLabel("Password").fill("DemoPass123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page
      .getByRole("group", { name: "Quantity for Free admission" })
      .locator("output"),
  ).toHaveText("1");
  await page.getByRole("button", { name: "Proceed to Checkout" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await page.getByRole("dialog").boundingBox())!.width).toBeGreaterThan(
    450,
  );
  await page.getByRole("button", { name: "Reserve and review" }).click();
  await page.getByRole("button", { name: "Confirm free registration" }).click();
  await expect(
    page.getByRole("heading", { name: "You’re going!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Admission QR code/ }),
  ).toBeVisible();
  expect(
    (await context.cookies()).find(
      (cookie) => cookie.name === "biletflow_session",
    )?.httpOnly,
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "You’re going!" }),
  ).toBeVisible();
});

test("paid campaign checkout uses server discount and produces separate tickets, PDF preview, and calendar", async ({
  page,
}) => {
  await login(page, "/campaign/offer");
  await expect(page).toHaveURL(new RegExp(`/events/${paidId}\\?promo=SAVE20`));
  await page
    .getByRole("button", { name: "Add General admission ticket" })
    .click();
  await page
    .getByRole("button", { name: "Add General admission ticket" })
    .click();
  await expect(page.getByText("−800,00", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Proceed to Checkout" }).click();
  await page.screenshot({
    path: "test-results/attendee-checkout.png",
    fullPage: false,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  const modal = (await page.getByRole("dialog").boundingBox())!;
  expect(modal.width).toBeGreaterThan(300);
  expect(modal.x + modal.width).toBeLessThanOrEqual(375);
  await page.screenshot({ path: "test-results/attendee-checkout-mobile.png" });
  await page.getByRole("button", { name: "Reserve and review" }).click();
  await expect(page.getByRole("dialog")).toContainText("Demo payment");
  await page.getByRole("button", { name: /Confirm demo payment/ }).click();
  await expect(
    page.getByRole("heading", { name: "You’re going!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Admission QR code/ }),
  ).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/attendee-order-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({
    path: "test-results/attendee-order.png",
    fullPage: true,
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to Calendar" }).click();
  expect((await download).suggestedFilename()).toBe(`biletflow-${paidId}.ics`);
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Download / Print PDF Ticket" })
    .first()
    .click();
  const popup = await popupPromise;
  await expect(
    popup.getByRole("heading", { name: "BiletFlow · Admission ticket" }),
  ).toBeVisible();
  await expect(
    popup.getByRole("button", { name: "Print / Save as PDF" }),
  ).toBeEnabled();
  const pdfDownload = popup.waitForEvent("download");
  await popup.getByRole("link", { name: "Download original PDF" }).click();
  expect((await pdfDownload).suggestedFilename()).toMatch(
    /^biletflow-ticket-.+\.pdf$/,
  );
  await popup.close();
  await page.getByRole("link", { name: "My Tickets", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "View order and tickets →" }),
  ).toBeVisible();
});

test("invalid codes and exhausted inventory are rejected without completing a payment", async ({
  page,
  request,
}) => {
  await login(page, `/events/${paidId}`);
  await page
    .getByRole("button", { name: "Add General admission ticket" })
    .click();
  await page.getByLabel("Promo code", { exact: true }).fill("EXPIRED");
  await page.getByRole("button", { name: "Apply promo code" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "invalid, expired, or exhausted" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Proceed to Checkout" }),
  ).toBeDisabled();
  await page.getByLabel("Promo code", { exact: true }).fill("");
  await page.getByRole("button", { name: "Apply promo code" }).click();
  await expect(
    page.getByRole("button", { name: "Proceed to Checkout" }),
  ).toBeEnabled();
  await request.post(`${fixture}/__control`, { data: { soldOut: true } });
  await page.getByRole("button", { name: "Proceed to Checkout" }).click();
  await page.getByRole("button", { name: "Reserve and review" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "sold out",
  );
  await expect(
    page.getByRole("button", { name: /Confirm demo payment/ }),
  ).toHaveCount(0);
});

test("an expired reservation cannot issue tickets", async ({
  page,
  request,
}) => {
  await login(page, `/events/${freeId}`);
  await page.getByRole("button", { name: "Add Free admission ticket" }).click();
  await page.getByRole("button", { name: "Proceed to Checkout" }).click();
  await request.post(`${fixture}/__control`, { data: { expired: true } });
  await page.getByRole("button", { name: "Reserve and review" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "This reservation has expired",
  );
  await expect(
    page.getByRole("button", { name: "Confirm free registration" }),
  ).toBeDisabled();
});

test("failed demo payment reports an error and never displays issued tickets", async ({
  page,
  request,
}) => {
  await login(page, `/events/${paidId}`);
  await page
    .getByRole("button", { name: "Add General admission ticket" })
    .click();
  await page.getByRole("button", { name: "Proceed to Checkout" }).click();
  await page.getByRole("button", { name: "Reserve and review" }).click();
  await request.post(`${fixture}/__control`, { data: { paymentError: true } });
  await page.getByRole("button", { name: /Confirm demo payment/ }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "No tickets were issued",
  );
  await expect(
    page.getByRole("img", { name: /Admission QR code/ }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/events/${paidId}`));
});

test("current backend gaps keep checkout available but never guess an order's tickets", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__control`, {
    data: { quoteMissing: true, orderDetailsMissing: true },
  });
  await login(page, `/events/${paidId}`);
  await page
    .getByRole("button", { name: "Add General admission ticket" })
    .click();
  await page.getByLabel("Promo code", { exact: true }).fill("SAVE20");
  await page.getByRole("button", { name: "Apply promo code" }).click();
  await expect(
    page.getByText("Estimated subtotal", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Proceed to Checkout" }).click();
  await page.getByRole("button", { name: "Reserve and review" }).click();
  await expect(page.getByRole("dialog")).toContainText("Discount (SAVE20)");
  await page.getByRole("button", { name: /Confirm demo payment/ }).click();
  await expect(
    page.getByRole("heading", { name: "You’re going!" }),
  ).toBeVisible();
  await expect(
    page.getByText("Itemized details are unavailable for this order."),
  ).toBeVisible();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "This order's ticket details are unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Admission QR code/ }),
  ).toHaveCount(0);
});

test("gateway rejects cross-origin login and checkout requests", async ({
  request,
}) => {
  for (const path of ["/api/auth/login", "/api/backend/checkout/sessions"]) {
    const response = await request.post(path, {
      headers: { Origin: "https://another-site.example" },
      data: {},
    });
    expect(response.status()).toBe(403);
  }
});
