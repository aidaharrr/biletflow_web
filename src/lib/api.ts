import type {
  ApiErrorEnvelope,
  Locale,
  Event,
  TicketType,
  Order,
  Ticket,
  CheckoutItem,
  CheckoutRequest,
  CheckoutQuote,
  PaginatedResponse,
  EventWrite,
  TicketTypeWrite,
  CampaignWrite,
  PromotionalCampaign,
  OrganizerProfile,
  PaidSalesChecklist,
  OrganizerSummary,
  SalesPoint,
  TicketTypeAnalytics,
  ActivityEntry,
  RefundResult,
  ActivationFeeResult,
  SupportCase,
  SupportMessage,
  SupportStatus,
  SupportCaseWrite,
} from "@/types/api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details: Record<string, unknown> = {},
    public readonly requestId?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Overrides the client token for this request; null explicitly disables auth. */
  accessToken?: string | null;
  params?: Record<string, string | number | boolean | null | undefined>;
  idempotencyKey?: string;
  locale?: Locale;
}

export interface ApiClientOptions {
  baseUrl?: string;
  getAccessToken?: () =>
    string | null | undefined | Promise<string | null | undefined>;
  fetch?: typeof globalThis.fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeBody(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    typeof body === "string"
  )
    return body;
  if (!headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  return JSON.stringify(body);
}

async function responseError(response: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    /* Proxy errors may be HTML or empty. */
  }
  const fallback = `Request failed (${response.status}).`;
  if (isRecord(payload) && isRecord(payload.error)) {
    const error = payload.error;
    return new ApiError(
      typeof error.message === "string" ? error.message : fallback,
      response.status,
      typeof error.code === "string" ? error.code : `HTTP_${response.status}`,
      isRecord(error.details) ? error.details : {},
      typeof error.request_id === "string"
        ? error.request_id
        : (response.headers.get("X-Request-ID") ?? undefined),
    );
  }
  // The current FastAPI implementation also returns { detail: string | ValidationError[] }.
  const detail = isRecord(payload) ? payload.detail : undefined;
  return new ApiError(
    typeof detail === "string" ? detail : fallback,
    response.status,
    `HTTP_${response.status}`,
    detail === undefined ? {} : { detail },
    response.headers.get("X-Request-ID") ?? undefined,
  );
}

/** Create one client per browser session or server request; tokens stay in memory.
 * Server callers must create their own instance to avoid sharing users' credentials.
 */
export function createApiClient({
  baseUrl = API_BASE_URL,
  getAccessToken,
  fetch: fetchImpl = globalThis.fetch,
}: ApiClientOptions = {}) {
  const base = new URL(`${baseUrl.replace(/\/+$/, "")}/`);
  let sessionAccessToken: string | null = null;

  async function send(
    path: string,
    options: ApiRequestOptions = {},
    accept = "application/json",
  ) {
    if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//")) {
      throw new TypeError(
        "API paths must be relative to the configured API base.",
      );
    }
    const url = new URL(path.replace(/^\/+/, ""), base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
      throw new TypeError("API path must stay within the configured API base.");
    }
    const {
      body,
      accessToken,
      params,
      idempotencyKey,
      locale,
      headers: customHeaders,
      ...init
    } = options;
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null)
        url.searchParams.set(key, String(value));
    }
    const headers = new Headers(customHeaders);
    if (!headers.has("Accept")) headers.set("Accept", accept);
    const token =
      accessToken !== undefined
        ? accessToken
        : getAccessToken
          ? await getAccessToken()
          : sessionAccessToken;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    else if (accessToken === null) headers.delete("Authorization");
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
    if (locale) headers.set("Accept-Language", locale);
    const serializedBody = serializeBody(body, headers);
    let response: Response;
    try {
      response = await fetchImpl(url, {
        credentials: "include",
        cache: "no-store",
        ...init,
        headers,
        body: serializedBody,
      });
    } catch (cause) {
      if (
        init.signal?.aborted ||
        (cause instanceof Error && cause.name === "AbortError")
      )
        throw cause;
      throw new ApiError(
        "Unable to reach BiletFlow API.",
        0,
        "NETWORK_ERROR",
        {},
        undefined,
        { cause },
      );
    }
    if (!response.ok) throw await responseError(response);
    return response;
  }

  async function request<T = unknown>(
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const response = await send(path, options);
    if (
      response.status === 204 ||
      response.status === 205 ||
      options.method?.toUpperCase() === "HEAD"
    )
      return undefined as T;
    const text = await response.text();
    if (!text.trim()) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch (cause) {
      throw new ApiError(
        "API returned invalid JSON.",
        response.status,
        "INVALID_RESPONSE",
        {},
        undefined,
        { cause },
      );
    }
  }

  return {
    setAccessToken(token: string | null) {
      sessionAccessToken = token;
    },
    clearAccessToken() {
      sessionAccessToken = null;
    },
    request,
    get: <T = unknown>(path: string, options?: ApiRequestOptions) =>
      request<T>(path, { ...options, method: "GET" }),
    post: <T = unknown>(
      path: string,
      body?: unknown,
      options?: ApiRequestOptions,
    ) => request<T>(path, { ...options, method: "POST", body }),
    put: <T = unknown>(
      path: string,
      body?: unknown,
      options?: ApiRequestOptions,
    ) => request<T>(path, { ...options, method: "PUT", body }),
    patch: <T = unknown>(
      path: string,
      body?: unknown,
      options?: ApiRequestOptions,
    ) => request<T>(path, { ...options, method: "PATCH", body }),
    delete: <T = void>(path: string, options?: ApiRequestOptions) =>
      request<T>(path, { ...options, method: "DELETE" }),
    download: async (
      path: string,
      options?: ApiRequestOptions,
    ): Promise<Blob> => (await send(path, options, "*/*")).blob(),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
export type { ApiErrorEnvelope };

let attendeeClient: ApiClient | undefined;

/** Browser requests use the same-origin gateway; the access token stays HttpOnly. */
export function getAttendeeClient(): ApiClient {
  if (typeof window === "undefined")
    throw new Error("Use a request-scoped API client on the server.");
  attendeeClient ??= createApiClient({
    baseUrl: new URL("/api/backend", window.location.origin).href,
  });
  return attendeeClient;
}

export async function collection<T>(
  path: string,
  options: ApiRequestOptions,
  client: ApiClient,
): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await client.get<T[] | PaginatedResponse<T>>(path, {
      ...options,
      params: { ...options.params, limit: 100, ...(cursor ? { cursor } : {}) },
    });
    if (Array.isArray(page)) return [...items, ...page];
    if (!page || !Array.isArray(page.items))
      throw new ApiError(
        "The server returned an invalid list.",
        200,
        "INVALID_RESPONSE",
      );
    items.push(...page.items);
    cursor = page.next_cursor ?? undefined;
    if (cursor && seen.has(cursor))
      throw new ApiError(
        "The server repeated a pagination cursor.",
        200,
        "INVALID_RESPONSE",
      );
    if (cursor) seen.add(cursor);
  } while (cursor);
  return items;
}

export function listEvents(
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return collection<Event>("/events", options, client);
}
export function getEvent(
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return client.get<Event>(`/events/${encodeURIComponent(id)}`, options);
}
export function listTicketTypes(
  eventId: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return collection<TicketType>(
    `/events/${encodeURIComponent(eventId)}/ticket-types`,
    options,
    client,
  );
}
export function validatePromoCode(
  eventId: string,
  items: CheckoutItem[],
  code: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return client.post<CheckoutQuote>(
    "/promo-codes/validate",
    { event_id: eventId, items, promo_code: code.trim().toUpperCase() || null },
    options,
  );
}
export function createCheckoutSession(
  body: CheckoutRequest,
  key: string,
  client = getAttendeeClient(),
) {
  return client.post<Order>("/checkout/sessions", body, {
    idempotencyKey: key,
  });
}
export function completeCheckoutSession(
  id: string,
  key: string,
  outcome: "success" | "failure" = "success",
  client = getAttendeeClient(),
) {
  return client.post<Order>(
    `/checkout/sessions/${encodeURIComponent(id)}/complete`,
    { outcome },
    { idempotencyKey: key },
  );
}
export function getOrder(
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return client.get<Order>(`/orders/${encodeURIComponent(id)}`, options);
}
export function listOrders(
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return collection<Order>("/orders", options, client);
}
export function listTickets(
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return collection<Ticket>("/tickets", options, client);
}
export function resolveCampaign(
  token: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return client.get<{ event_id: string; promo_code: string }>(
    `/campaigns/resolve/${encodeURIComponent(token)}`,
    options,
  );
}
export function getTicketQr(
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return client.download(`/tickets/${encodeURIComponent(id)}/qr`, options);
}
export function getTicketPdf(
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return client.download(`/tickets/${encodeURIComponent(id)}/pdf`, options);
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "Your session has expired. Please sign in again.";
    if (error.status === 403) return "You do not have access to this page.";
    if (error.status === 404)
      return "This resource or API route is unavailable. Please try again or contact support.";
    if (error.code === "NETWORK_ERROR")
      return "We could not reach BiletFlow. Please try again.";
    const detail = error.details.detail;
    if (Array.isArray(detail))
      return detail
        .map((field: { msg?: string }) => field.msg ?? "Invalid field")
        .join(". ");
    return error.message;
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export function listOrganizerEvents(
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return collection<Event>("/organizer/events", options, client);
}
/** Managed event reads use the authorized list: the current public read hides drafts. */
export async function getManagedEvent(
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  const event = (await listOrganizerEvents(options, client)).find(
    (event) => event.id === id,
  );
  if (!event)
    throw new ApiError(
      "Event not found among your managed events.",
      404,
      "NOT_FOUND",
    );
  return event;
}
export function createEvent(
  body: EventWrite,
  key: string,
  client = getAttendeeClient(),
) {
  return client.post<Event>("/events", body, { idempotencyKey: key });
}
export function updateEvent(
  id: string,
  body: Partial<Omit<EventWrite, "venue" | "time_zone" | "admission_type">>,
  client = getAttendeeClient(),
) {
  return client.patch<Event>(`/events/${encodeURIComponent(id)}`, body);
}
export function attachEventImage(
  id: string,
  url: string,
  client = getAttendeeClient(),
) {
  return client.post<unknown>(`/events/${encodeURIComponent(id)}/images`, {
    url,
  });
}
export function createTicketType(
  id: string,
  body: TicketTypeWrite,
  key: string,
  client = getAttendeeClient(),
) {
  return client.post<TicketType>(
    `/events/${encodeURIComponent(id)}/ticket-types`,
    body,
    { idempotencyKey: key },
  );
}
export function publishEvent(id: string, client = getAttendeeClient()) {
  return client.post<Event>(`/events/${encodeURIComponent(id)}/publish`);
}
export function unpublishEvent(id: string, client = getAttendeeClient()) {
  return client.post<Event>(`/events/${encodeURIComponent(id)}/unpublish`);
}
export function duplicateEvent(
  id: string,
  key: string,
  client = getAttendeeClient(),
) {
  return client.post<Event>(
    `/events/${encodeURIComponent(id)}/duplicate`,
    undefined,
    { idempotencyKey: key },
  );
}
export function cancelEvent(
  id: string,
  reason: string,
  key: string,
  client = getAttendeeClient(),
) {
  return client.post<Event>(
    `/events/${encodeURIComponent(id)}/cancel`,
    { reason },
    { idempotencyKey: key },
  );
}
export function getOrganizerSummary(
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return client.get<OrganizerSummary>("/organizer/analytics/summary", {
    ...options,
    params: { ...options.params, event_id: id },
  });
}
export function getSalesSeries(
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return collection<SalesPoint>(
    "/organizer/analytics/sales-series",
    { ...options, params: { ...options.params, event_id: id } },
    client,
  );
}
export function getTicketTypeAnalytics(
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return collection<TicketTypeAnalytics>(
    "/organizer/analytics/ticket-types",
    { ...options, params: { ...options.params, event_id: id } },
    client,
  );
}
export function listEventOrders(
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return collection<Order>(
    `/events/${encodeURIComponent(id)}/orders`,
    options,
    client,
  );
}
export function listEventHistory(
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return collection<ActivityEntry>(
    `/events/${encodeURIComponent(id)}/history`,
    options,
    client,
  );
}
export function refundOrder(
  id: string,
  reason: string,
  key: string,
  client = getAttendeeClient(),
) {
  return client.post<RefundResult>(
    `/orders/${encodeURIComponent(id)}/refunds`,
    { reason },
    { idempotencyKey: key },
  );
}
export function listCampaigns(
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return collection<PromotionalCampaign>(
    `/events/${encodeURIComponent(id)}/campaigns`,
    options,
    client,
  );
}
export function createCampaign(
  id: string,
  body: CampaignWrite,
  key: string,
  client = getAttendeeClient(),
) {
  return client.post<PromotionalCampaign>(
    `/events/${encodeURIComponent(id)}/campaigns`,
    body,
    { idempotencyKey: key },
  );
}
export function getCampaignQr(
  eventId: string,
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return client.download(
    `/events/${encodeURIComponent(eventId)}/campaigns/${encodeURIComponent(id)}/qr`,
    options,
  );
}
export function getPaidSales(
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return client.get<PaidSalesChecklist>(
    `/events/${encodeURIComponent(id)}/paid-sales`,
    options,
  );
}
export function saveOrganizerProfile(
  body: Pick<
    OrganizerProfile,
    "contact_name" | "organization_name" | "contact_phone"
  >,
  client = getAttendeeClient(),
) {
  return client.put<OrganizerProfile>("/organizer-profile", body);
}
export function verifyOrganizerProfile(client = getAttendeeClient()) {
  return client.post<OrganizerProfile>(
    "/organizer-profile/verification/submit",
  );
}
export function connectSandboxPayout(
  reference: string,
  client = getAttendeeClient(),
) {
  return client.put<OrganizerProfile>(
    "/organizer-profile/payout-account",
    undefined,
    { params: { account_reference: reference } },
  );
}
export function acceptPaidTerms(id: string, client = getAttendeeClient()) {
  return client.post<{ accepted: boolean; terms_version: string }>(
    `/events/${encodeURIComponent(id)}/paid-sales/accept-terms`,
  );
}
export function payActivationFee(
  id: string,
  key: string,
  client = getAttendeeClient(),
) {
  return client.post<ActivationFeeResult>(
    `/events/${encodeURIComponent(id)}/paid-sales/activation-fee`,
    { outcome: "success" },
    { idempotencyKey: key },
  );
}
export function activatePaidSales(
  id: string,
  key: string,
  client = getAttendeeClient(),
) {
  return client.post<{ status: string; is_simulation: boolean }>(
    `/events/${encodeURIComponent(id)}/paid-sales/activate`,
    undefined,
    { idempotencyKey: key },
  );
}
export function listSupportCases(
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return collection<SupportCase>("/support/cases", options, client);
}
export function createSupportCase(
  body: SupportCaseWrite,
  key: string,
  client = getAttendeeClient(),
) {
  return client.post<SupportCase>("/support/cases", body, {
    idempotencyKey: key,
  });
}
export function listSupportMessages(
  id: string,
  options: ApiRequestOptions = {},
  client = getAttendeeClient(),
) {
  return collection<SupportMessage>(
    `/support/cases/${encodeURIComponent(id)}/messages`,
    options,
    client,
  );
}
export function sendSupportMessage(
  id: string,
  body: string,
  key: string,
  client = getAttendeeClient(),
) {
  return client.post<SupportMessage>(
    `/support/cases/${encodeURIComponent(id)}/messages`,
    { body },
    { idempotencyKey: key },
  );
}
export function updateSupportStatus(
  id: string,
  status: SupportStatus,
  client = getAttendeeClient(),
) {
  return client.patch<SupportCase>(
    `/support/cases/${encodeURIComponent(id)}/status`,
    undefined,
    { params: { status } },
  );
}
