import {
  backendFetch,
  gatewayError,
  rejectCrossOrigin,
} from "@/lib/server-api";
import { getAdminAccess } from "@/lib/server-admin";

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
    GET: /^(events(?:\/[^/]+(?:\/(ticket-types|orders|history|paid-sales|campaigns)(?:\/[^/]+(?:\/qr)?)?)?)?|orders(?:\/[^/]+)?|tickets(?:\/[^/]+(?:\/(qr|pdf))?)?|campaigns\/resolve\/[^/]+|organizer\/events|organizer\/analytics\/(summary|sales-series|ticket-types|campaigns|attendance)|support\/cases(?:\/[^/]+\/messages)?)$/,
    POST: /^(events(?:\/[^/]+\/(publish|unpublish|cancel|duplicate|images|ticket-types|campaigns|paid-sales\/(accept-terms|activation-fee|activate)))?|orders\/[^/]+\/(refunds|resend-confirmation)|checkout\/sessions(?:\/[^/]+\/(complete|cancel))?|promo-codes\/validate|organizer-profile\/verification\/submit|support\/cases(?:\/[^/]+\/messages)?)$/,
    PUT: /^organizer-profile(?:\/payout-account)?$/,
    PATCH:
      /^(events\/[^/]+(?:\/campaigns\/[^/]+)?|support\/cases\/[^/]+\/status)$/,
  };
  const adminRead =
    /^admin\/(users|events|campaigns|organizer-applications|support\/cases|reports\/operations)$/;
  const adminWrite =
    /^admin\/(organizer-applications\/[^/]+\/(approve|reject)|events\/[^/]+\/suspend|users\/[^/]+\/(suspend|revoke-access))$/;
  const adminAllowed =
    request.method === "GET"
      ? adminRead.test(route)
      : request.method === "POST" && adminWrite.test(route);
  if (!allowed[request.method]?.test(route) && !adminAllowed)
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
    if (route.startsWith("admin/")) {
      const access = await getAdminAccess();
      if (!access.user)
        return Response.json(
          {
            error: {
              code:
                access.status === 401
                  ? "UNAUTHENTICATED"
                  : access.status === 403
                    ? "FORBIDDEN"
                    : "AUTH_CHECK_FAILED",
              message:
                access.status === 502
                  ? "Unable to verify administrator access. Please try again."
                  : "An active Admin account is required.",
              details: {},
            },
          },
          { status: access.status, headers: { "Cache-Control": "no-store" } },
        );
    }
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
    const body = ["POST", "PUT", "PATCH"].includes(request.method)
      ? await request.text()
      : undefined;
    const suspendingEvent =
      request.method === "POST" &&
      /^admin\/events\/[^/]+\/suspend$/.test(route);
    if (suspendingEvent) {
      let reason: unknown;
      try {
        reason = JSON.parse(body ?? "{}").reason;
      } catch {
        reason = null;
      }
      if (
        typeof reason !== "string" ||
        reason.trim().length < 3 ||
        reason.trim().length > 500
      )
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Enter a suspension reason from 3 to 500 characters.",
              details: {},
            },
          },
          { status: 422 },
        );
      // Unpublish first: this hides the event and blocks free as well as paid checkout.
      const hidden = await backendFetch(
        `events/${encodeURIComponent(path[2])}/unpublish`,
        { method: "POST", headers },
      );
      if (!hidden.ok)
        return new Response(hidden.body, {
          status: hidden.status,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      const hiddenEvent = await hidden.json();
      if (hiddenEvent.status !== "draft")
        return Response.json(
          {
            error: {
              code: "EVENT_HIDE_NOT_CONFIRMED",
              message:
                "Event hiding was not confirmed by the backend. Refresh the event before retrying.",
              details: {},
            },
          },
          { status: 502 },
        );
      let response: Response;
      try {
        response = await backendFetch(
          `${path.map(encodeURIComponent).join("/")}`,
          { method: "POST", headers, body },
        );
      } catch {
        return partialSuspension();
      }
      if (!response.ok) return partialSuspension();
      const outcome = await response.json().catch(() => null);
      if (outcome?.status !== "suspended") return partialSuspension();
      return Response.json(
        {
          status: "suspended",
          event_id: path[2],
          event_hidden: true,
          paid_sales_stopped: true,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const response = await backendFetch(
      `${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`,
      {
        method: request.method,
        headers,
        ...(body !== undefined ? { body } : {}),
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

function partialSuspension() {
  return Response.json(
    {
      error: {
        code: "EVENT_SUSPENSION_INCOMPLETE",
        message:
          "The event was hidden and checkout was stopped, but the paid-sales suspension record could not be completed. Retry to finish the action.",
        details: { event_hidden: true },
      },
    },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
