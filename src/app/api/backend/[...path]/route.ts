import {
  backendFetch,
  gatewayError,
  rejectCrossOrigin,
} from "@/lib/server-api";

async function proxy(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const { path } = await params;
  if (path.some((segment) => segment === "." || segment === ".."))
    return new Response(null, { status: 404 });
  const route = path.join("/");
  const allowed: Record<string, RegExp> = {
    GET: /^(events(?:\/[^/]+(?:\/(ticket-types|orders|history|paid-sales|campaigns)(?:\/[^/]+\/qr)?)?)?|orders(?:\/[^/]+)?|tickets(?:\/[^/]+(?:\/(qr|pdf))?)?|campaigns\/resolve\/[^/]+|organizer\/events|organizer\/analytics\/(summary|sales-series|ticket-types|campaigns|attendance)|support\/cases(?:\/[^/]+\/messages)?)$/,
    POST: /^(events(?:\/[^/]+\/(publish|unpublish|cancel|duplicate|images|ticket-types|campaigns|paid-sales\/(accept-terms|activation-fee|activate)))?|orders\/[^/]+\/refunds|checkout\/sessions(?:\/[^/]+\/complete)?|promo-codes\/validate|organizer-profile\/verification\/submit|support\/cases(?:\/[^/]+\/messages)?)$/,
    PUT: /^organizer-profile(?:\/payout-account)?$/,
    PATCH: /^(events\/[^/]+|support\/cases\/[^/]+\/status)$/,
  };
  if (!allowed[request.method]?.test(route))
    return Response.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Route not available.",
          details: {},
        },
      },
      { status: 404 },
    );
  try {
    const headers = new Headers();
    for (const name of [
      "content-type",
      "accept",
      "accept-language",
      "idempotency-key",
    ]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const response = await backendFetch(
      `${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`,
      {
        method: request.method,
        headers,
        ...(["POST", "PUT", "PATCH"].includes(request.method)
          ? { body: await request.text() }
          : {}),
      },
    );
    const outputHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of [
      "content-type",
      "content-disposition",
      "x-request-id",
    ]) {
      const value = response.headers.get(name);
      if (value) outputHeaders.set(name, value);
    }
    return new Response(response.body, {
      status: response.status,
      headers: outputHeaders,
    });
  } catch (error) {
    return gatewayError(error);
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
