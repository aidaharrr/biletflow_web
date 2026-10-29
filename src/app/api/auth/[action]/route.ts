import { cookies } from "next/headers";
import {
  backendFetch,
  gatewayError,
  rejectCrossOrigin,
  SESSION_COOKIE,
} from "@/lib/server-api";
import type { LoginResponse } from "@/types/api";

/** Public, unauthenticated account-email actions passed through to the backend. */
const EMAIL_ACTIONS = new Set([
  "verify-email",
  "resend-verification",
  "forgot-password",
  "reset-password",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  if ((await params).action !== "session")
    return new Response(null, { status: 404 });
  if (!(await cookies()).has(SESSION_COOKIE))
    return Response.json(
      { user: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  try {
    const response = await backendFetch("users/me");
    if (response.status === 401) {
      (await cookies()).delete(SESSION_COOKIE);
      return Response.json({ user: null });
    }
    if (!response.ok)
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    return Response.json(
      { user: await response.json() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return gatewayError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const rejected = rejectCrossOrigin(request);
  if (rejected) return rejected;
  const { action } = await params;
  if (action === "logout") {
    (await cookies()).delete(SESSION_COOKIE);
    return new Response(null, { status: 204 });
  }
  if (action !== "login" && action !== "register" && !EMAIL_ACTIONS.has(action))
    return new Response(null, { status: 404 });
  try {
    const response = await backendFetch(
      `auth/${action}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await request.text(),
      },
      false,
    );
    if (!response.ok)
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    if (action === "register")
      return Response.json(await response.json(), { status: 201 });
    // Email actions never create a session; demo token headers are not forwarded.
    if (EMAIL_ACTIONS.has(action))
      return new Response(response.status === 204 ? null : response.body, {
        status: response.status,
        headers: {
          ...(response.status === 204
            ? {}
            : { "Content-Type": "application/json" }),
          "Cache-Control": "no-store",
        },
      });
    const session = (await response.json()) as LoginResponse;
    (await cookies()).set(SESSION_COOKIE, session.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: session.expires_in,
    });
    return Response.json(
      { user: session.user },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return gatewayError(error);
  }
}
