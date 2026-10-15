import "server-only";
import { cookies } from "next/headers";
import { ApiError, API_BASE_URL } from "./api";

export const SESSION_COOKIE = "biletflow_session";
export const BACKEND_URL = process.env.API_BASE_URL ?? API_BASE_URL;

export function rejectCrossOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next.js may use its bind hostname in request.url. The Host header identifies
  // the address used by the browser; do not trust forwarded hosts here.
  const expectedOrigin = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  if (
    (origin && origin !== expectedOrigin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return Response.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Please submit this request from BiletFlow.",
          details: {},
        },
      },
      { status: 403 },
    );
  }
  return null;
}

export async function backendFetch(
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (authenticated) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(
    `${BACKEND_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`,
    {
      ...init,
      headers,
      cache: "no-store",
      redirect: "error",
      signal: init.signal ?? AbortSignal.timeout(20_000),
    },
  );
}

export function gatewayError(error: unknown): Response {
  return Response.json(
    {
      error: {
        code: error instanceof ApiError ? error.code : "NETWORK_ERROR",
        message:
          error instanceof ApiError
            ? error.message
            : "We could not reach BiletFlow. Please try again.",
        details: {},
      },
    },
    { status: error instanceof ApiError && error.status ? error.status : 502 },
  );
}
