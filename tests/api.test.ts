import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, createApiClient } from "../src/lib/api";
import { formatKZT } from "../src/lib/money";
import { cn } from "../src/lib/cn";

function mockFetch(
  handler: (url: URL, init: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return async (input, init) => handler(new URL(String(input)), init ?? {});
}

test("injects current Bearer tokens, cookie credentials, locale, and query parameters", async () => {
  const client = createApiClient({
    fetch: mockFetch((url, init) => {
      assert.equal(url.href, "http://localhost:8000/api/v1/events?limit=20");
      assert.equal(
        new Headers(init.headers).get("Authorization"),
        "Bearer current",
      );
      assert.equal(new Headers(init.headers).get("Accept-Language"), "kk");
      assert.equal(init.credentials, "include");
      assert.equal(init.cache, "no-store");
      return Response.json({ items: [], next_cursor: null });
    }),
  });
  client.setAccessToken("old");
  client.setAccessToken("current");
  assert.deepEqual(
    await client.get("/events", {
      params: { limit: 20, cursor: null },
      locale: "kk",
    }),
    { items: [], next_cursor: null },
  );
});

test("isolates client credentials, clears logout tokens, and supports public request overrides", async () => {
  const observed: (string | null)[] = [];
  const fetch = mockFetch((_url, init) => {
    observed.push(new Headers(init.headers).get("Authorization"));
    return Response.json({});
  });
  const first = createApiClient({ fetch });
  const second = createApiClient({ fetch });
  first.setAccessToken("alice");
  second.setAccessToken("bob");
  await Promise.all([first.get("users/me"), second.get("users/me")]);
  await first.get("events", {
    accessToken: null,
    headers: { Authorization: "Bearer stale" },
  });
  first.clearAccessToken();
  await first.get("events");
  assert.deepEqual(observed, ["Bearer alice", "Bearer bob", null, null]);
});

test("reads an asynchronous token provider on each request", async () => {
  let token = "first";
  const observed: string[] = [];
  const client = createApiClient({
    getAccessToken: async () => token,
    fetch: mockFetch((_url, init) => {
      observed.push(new Headers(init.headers).get("Authorization")!);
      return Response.json({});
    }),
  });
  await client.get("users/me");
  token = "rotated";
  await client.get("users/me");
  assert.deepEqual(observed, ["Bearer first", "Bearer rotated"]);
});

test("serializes JSON payments and preserves idempotency and caller headers", async () => {
  const client = createApiClient({
    fetch: mockFetch((_url, init) => {
      assert.equal(init.method, "POST");
      assert.equal(init.body, '{"amount":150000,"currency":"KZT"}');
      const headers = new Headers(init.headers);
      assert.equal(headers.get("Content-Type"), "application/json");
      assert.equal(headers.get("Idempotency-Key"), "checkout-123");
      assert.equal(headers.get("X-Custom"), "kept");
      return Response.json({ status: "confirmed" });
    }),
  });
  await client.post(
    "checkout/sessions/123/complete",
    { amount: 150000, currency: "KZT" },
    { idempotencyKey: "checkout-123", headers: { "X-Custom": "kept" } },
  );
});

test("keeps FormData intact and lets fetch set the multipart boundary", async () => {
  const form = new FormData();
  form.set("image", new Blob(["image"], { type: "image/png" }), "cover.png");
  const client = createApiClient({
    fetch: mockFetch((_url, init) => {
      assert.equal(init.body, form);
      assert.equal(new Headers(init.headers).get("Content-Type"), null);
      return Response.json({ id: "upload" });
    }),
  });
  await client.post("uploads/images", form);
});

test("accepts 204 responses and returns ticket files as Blobs", async () => {
  const client = createApiClient({
    fetch: mockFetch((url, init) => {
      if (url.pathname.endsWith("/pdf")) {
        assert.equal(new Headers(init.headers).get("Accept"), "*/*");
        return new Response("%PDF example", {
          headers: { "Content-Type": "application/pdf" },
        });
      }
      return new Response(null, { status: 204 });
    }),
  });
  assert.equal(await client.delete("auth/sessions/123"), undefined);
  const pdf = await client.download("tickets/123/pdf");
  assert.equal(pdf.type, "application/pdf");
  assert.equal(await pdf.text(), "%PDF example");
});

test("preserves structured inventory errors, validation details, and request IDs", async () => {
  const client = createApiClient({
    fetch: mockFetch(() =>
      Response.json(
        {
          error: {
            code: "TICKET_INVENTORY_EXHAUSTED",
            message: "Sold out",
            details: { ticket_type_id: "123" },
            request_id: "req_123",
          },
        },
        { status: 409 },
      ),
    ),
  });
  await assert.rejects(client.post("checkout/sessions"), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 409);
    assert.equal(error.code, "TICKET_INVENTORY_EXHAUSTED");
    assert.equal(error.message, "Sold out");
    assert.equal(error.requestId, "req_123");
    assert.deepEqual(error.details, { ticket_type_id: "123" });
    return true;
  });
});

test("handles FastAPI validation errors and non-JSON proxy failures", async () => {
  const detail = [
    { loc: ["body", "email"], msg: "Invalid email", type: "value_error" },
  ];
  const validation = createApiClient({
    fetch: mockFetch(() => Response.json({ detail }, { status: 422 })),
  });
  await assert.rejects(validation.post("auth/register"), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 422);
    assert.deepEqual(error.details, { detail });
    return true;
  });
  const proxy = createApiClient({
    fetch: mockFetch(
      () => new Response("<h1>Bad gateway</h1>", { status: 502 }),
    ),
  });
  await assert.rejects(
    proxy.get("events"),
    (error: unknown) => error instanceof ApiError && error.code === "HTTP_502",
  );
});

test("distinguishes invalid JSON, network failures, and cancellation", async () => {
  const invalid = createApiClient({
    fetch: mockFetch(() => new Response("not JSON")),
  });
  await assert.rejects(
    invalid.get("events"),
    (error: unknown) =>
      error instanceof ApiError && error.code === "INVALID_RESPONSE",
  );
  const network = createApiClient({
    fetch: mockFetch(() => {
      throw new TypeError("Failed to fetch");
    }),
  });
  await assert.rejects(
    network.get("events"),
    (error: unknown) =>
      error instanceof ApiError &&
      error.code === "NETWORK_ERROR" &&
      error.status === 0,
  );
  const aborted = new DOMException("Aborted", "AbortError");
  const cancelled = createApiClient({
    fetch: mockFetch(() => {
      throw aborted;
    }),
  });
  await assert.rejects(
    cancelled.get("events"),
    (error: unknown) => error === aborted,
  );
});

test("rejects external URLs and path traversal before sending credentials", async () => {
  const client = createApiClient({
    fetch: mockFetch(() => {
      assert.fail("fetch must not run");
    }),
  });
  client.setAccessToken("private");
  for (const path of [
    "https://example.com/events",
    "//example.com/events",
    "../admin",
    "%2e%2e/admin",
    "\\\\example.com/events",
  ]) {
    await assert.rejects(client.get(path), TypeError);
  }
});

test("formats integer minor units as KZT and rejects decimal or unsafe amounts", () => {
  assert.equal(formatKZT(150000, "en-US"), "KZT\u00a01,500.00");
  assert.equal(formatKZT(0, "en-US"), "KZT\u00a00.00");
  assert.equal(formatKZT(-150000, "en-US"), "-KZT\u00a01,500.00");
  assert.throws(() => formatKZT(1500.5), RangeError);
  assert.throws(() => formatKZT(Number.MAX_SAFE_INTEGER + 1), RangeError);
  assert.throws(() => formatKZT(100, "en-US", -1), RangeError);
});

test("custom typography tokens are retained alongside colors when merging classes", () => {
  assert.equal(cn("text-button", "text-white"), "text-button text-white");
  assert.equal(
    cn("text-badge", "text-text-primary"),
    "text-badge text-text-primary",
  );
  assert.equal(cn("text-label", "text-lg text-error"), "text-lg text-error");
  assert.equal(
    cn("disabled:opacity-disabled", "disabled:opacity-50"),
    "disabled:opacity-50",
  );
});

test("errorMessage prefers specific backend detail over generic 403/404 text", async () => {
  const { errorMessage } = await import("../src/lib/api");
  const failing = (status: number, detail: string) =>
    createApiClient({
      fetch: mockFetch(() => Response.json({ detail }, { status })),
    }).get("/x");
  const message = async (status: number, detail: string) =>
    errorMessage(await failing(status, detail).catch((error) => error));
  assert.equal(
    await message(403, "Verify your email address before publishing events"),
    "Verify your email address before publishing events",
  );
  assert.equal(await message(404, "Campaign not found"), "Campaign not found");
  assert.equal(
    await message(404, "Not Found"),
    "This resource or API route is unavailable. Please try again or contact support.",
  );
  assert.equal(
    await message(403, "Insufficient permissions"),
    "You do not have access to this page.",
  );
  assert.equal(
    await message(401, "Invalid authentication"),
    "Your session has expired. Please sign in again.",
  );
});
