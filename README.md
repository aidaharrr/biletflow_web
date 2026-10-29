# BiletFlow Web

Next.js 16, TypeScript, Tailwind CSS 4, and App Router under `src/app`.

## Run locally

From this folder, run `npm install` if dependencies are missing, then `npm run dev`.
Open http://localhost:3000/events to browse events. In PowerShell, use
`npm.cmd` if the execution policy prevents running `npm.ps1`.

The API defaults to `http://localhost:8000/api/v1`. Copy `.env.example` to
`.env.local` to change the server-side `API_BASE_URL`, then restart Next.js.
Browser requests use the same-origin Next.js API gateway, so the attendee flow
does not require browser-to-backend CORS. The frontend does not start the backend.

## Attendee routes

- `/events`: public published events, title/venue search, category filters,
  responsive cards, date/time in the event's time zone, and KZT prices.
- `/events/[id]`: description, organizer name, venue/map link, inventory-aware
  ticket quantities, server promo quotes, and attendee checkout in a modal.
- `/orders/[id]`: owned order totals, itemized tickets, canonical backend QR
  images, a print-styled PDF window, and a downloadable `.ics` calendar file.
- `/tickets`: owned orders and access to digital tickets; profile and sign-out.
- `/login` and `/register`: authentication with a safe return destination.
  Ticket quantities and a campaign promo survive the sign-in redirect. After
  registration the page confirms that a verification link was emailed.
- `/verify-email?token=…`: submits the emailed verification token once.
- `/forgot-password` and `/reset-password?token=…`: request a reset email (the
  response never reveals whether an account exists) and set a new password. Used
  or expired links show the backend's explanation.
- Signed-in users with an unverified email see a banner with **Resend
  verification email**. Organizers must verify before publishing.
- `/campaign/[token]`: resolve an opaque campaign token. A usable promotion opens
  the event with the code pre-applied; expired, disabled, exhausted, or scheduled
  promotions show the server's message with a link to the event without it.

Account-email actions use the same-origin `/api/auth/[action]` gateway
(`verify-email`, `resend-verification`, `forgot-password`, `reset-password`),
which never sets a session cookie for them. Email links come from the backend's
`APP_FRONTEND_URL`, so it must match this site's public origin.

Loading indicators, empty states, accessible form labels, and retryable API errors
are included. Real attendee data comes from the backend; test fixtures are never
used as a production fallback. Paid checkout follows the backend's demo payment
completion flow and clearly states that no real money is charged.

## Organizer portal

Open `/organizer/dashboard` after signing in with an account that has the
`organizer` role. Organizer access is checked server-side; ownership and staff
permissions remain enforced by the backend on every operation. Registration
does not grant organizer privileges. `/organizer` redirects to the dashboard.

- `/organizer/dashboard`: `StatCard` overview of gross confirmed sales, weighted
  capacity/attendance percentages, and redemptions in currently active campaigns.
  Upcoming/Active/Completed/Cancelled tabs retain access to historical records.
  Row actions open analytics/attendees, duplicate into a resumable draft, or
  confirm cancellation. Failed metrics display unavailable values; event rows
  remain usable. Summary values are fetched separately for each managed event.
- `/organizer/events/create`: details, free/paid ticket configuration, preview,
  and event-specific sandbox activation. The draft ID enters the URL after saving
  details. Successfully saved ticket types are retained on partial failure and
  skipped on retry. Resumed types are read-only because ticket edits are not
  implemented in the current backend. A duplicate opens with reusable source
  ticket configuration, which is saved as new types without historical counts.
- `/organizer/campaigns`: event selector, percentage/fixed-KZT promo creation,
  redemption limits, validity dates, optional applicable paid ticket types,
  server state badges, link visits, redemptions (including checkout holds),
  orders/tickets and gross/discount/net from `/organizer/analytics/campaigns`,
  Edit (name, dates, limit, applicable types) and Enable/Disable via `PATCH`, and
  the server-generated purple "PROMO OFFER · Not an admission ticket" QR. Code and
  discount are fixed after creation. Share links contain only an opaque token.
- `/organizer/events/[id]`: all-time server summary, capacity and attendance
  progress, sales series with inclusive UTC date filters, ticket-type comparison,
  searchable order attendees, full simulated refunds with confirmation, and
  chronological server audit history. Filters are scoped and labeled: date range
  affects the sales series; ticket type affects the comparison table. Event
  summary cards stay all-time. One attendee table row represents one order.
- `/organizer/support`: contextual inbox, status/event/search filters, message
  threads, replies, staff status updates, and organizer platform-support requests.
  Messages poll every 15 seconds; the inbox polls every 30 seconds while visible.
  Polling and inbox refresh preserve unsent replies. Own requests have status
  controls delegated to platform staff, matching the current API restriction.

Creation dates use `Asia/Almaty` with an explicit UTC+05:00 offset, independent of
the browser time zone. Money inputs are decimal strings converted to safe integer
minor units. Campaign figures come from the backend's campaign analytics:
gross is the ticket subtotal and net is gross minus the discount (processing fees
excluded); refunded, pending, and failed orders are excluded.

Organizer integration gaps in the inspected backend:

1. Banner attachment is documented but not implemented. The frontend attempts
   `POST /events/{id}/images` with `{ url }`, a proposed URL attachment payload.
   The wizard preserves the saved draft and offers retry or explicit continuation
   without the image. No banner is claimed to have been saved on failure.
2. The current cancellation route ignores a submitted reason; the UI sends it,
   but recording that reason in audit history requires backend support. The current
   duplication route does not copy ticket types, so the wizard materializes the
   visible source configuration as new records at its ticket step. Managed-event
   responses omit hidden ticket types, so their inventory and duplication require
   a fuller authorized backend response.
3. The backend summary counts ticket-type quantities as capacity and sums only
   confirmed orders for gross/discount/receipt totals. Its net calculation subtracts
   historical refunds from confirmed receipts; financial definitions need backend
   alignment before this can represent lifetime net revenue. The frontend displays
   the returned metrics and their scope rather than inventing a financial ledger.

`GET /events/{id}` hides draft/private events even for organizers; managed reads
therefore use `/organizer/events`. Verification uses profile PUT followed by
verification POST; payout and support status use their implemented query-string
parameters. The backend's public `APP_FRONTEND_URL` must match the web origin so
the downloaded campaign QR targets the same site as the displayed share link.
Native image uploads, assigned seats, staff assignment, and real payments remain
outside this portal task. The backend source was not modified.

## Platform admin portal

Sign in with a real backend account whose role is `platform_admin` (displayed as
Admin), then open `/admin/dashboard`. The Navbar shows **Admin Panel** only for
this role. Server-side layout and API gateway checks reject inactive accounts and
other roles. `/admin` redirects to the dashboard.

- `/admin/dashboard`: registered users, active published events, pending organizer
  applications, escalated support, and links to moderation queues. Escalated case
  details open in a read-only review dialog.
- `/admin/organizers`: pending/reviewed applications, masked sandbox identity and
  payout details, an activation readiness checklist, and approval/rejection dialogs.
  Incomplete applications cannot be approved. Rejection requires a reason.
- `/admin/events`: title search, Published/Draft/Suspended filters, event review,
  and suspension with a reason. Visibility and paid-sales suspension are shown
  separately when only part of an operation succeeds.
- `/admin/users`: email search, account status filters, roles, user details,
  session revocation, and account suspension with confirmation. The acting admin
  cannot restrict their own account. Revocation ends sessions while suspension
  disables the account; these are separate operations.
- `/admin/campaigns`: platform-wide promo activity (event, code, discount, state,
  link visits, redemptions) with code/event search, in live and demo modes.

### Biweekly report demo

Open `/admin/dashboard?mode=demo` after signing in as an admin, or choose **Use demo
data** in the portal. This explicitly selected mode uses typed static sample data
and sends no moderation mutations to the backend. It still requires a running
backend and a valid admin session; demo mode does not bypass authentication.

Sample approvals, rejection reasons, event suspensions, and user restrictions
carry across portal navigation. Use **Reset demo data** or reload the browser to
restore the seed. The mode and sample snapshot date are clearly displayed. Sample
changes are held in memory and are not saved to backend records or browser storage.
Approving an application demonstrates the review decision; it does not activate
paid sales automatically.

### Admin API coverage and limits

Live mode uses existing `/admin/users`, `/admin/events`, and
`/admin/reports/operations` reads, plus supported user/event suspension routes.
The inspected backend caps the user and event directories at 100 records. The
registered-user metric uses the operations report's full count; the active-event
metric is unavailable when the loaded list cannot cover the platform total.
Missing metrics display an explanation instead of zero.

The following proposed routes are not implemented in the inspected backend:

- `GET /admin/organizer-applications` and
  `POST /admin/organizer-applications/{id}/approve|reject`.
- `GET /admin/support/cases?escalated=true`; responses must explicitly identify
  escalations, since ordinary support statuses do not establish escalation.
- `POST /admin/users/{id}/revoke-access`.

Proposed response types include `OrganizerApplication`, `AdminSupportCase`, and
`AdminRevocationResult` in `src/types/api.ts`. Live mode reports missing routes
explicitly and offers the demo mode. Authentication, permission, network, and
server failures are never silently replaced with sample data.

The existing event-suspension endpoint stops paid sales but does not hide a public
event. The gateway therefore unpublishes the event first, confirms draft status,
then suspends paid sales. These are two nontransactional backend calls. If the
second fails, the UI states that the event is hidden, preserves the reason, and
allows a manual retry. The current backend can still allow organizers to
republish an event; a permanent moderation lock requires backend enforcement.
Live suspension endpoints also record only generic audit actions: retaining the
submitted custom reasons requires backend changes. Demo mode retains those reasons.
No backend source was changed for this portal.

## Design system

`tailwind.config.ts` contains the mobile theme tokens under `theme.extend`.
`src/app/globals.css` loads this config explicitly with Tailwind 4's `@config`.
Poppins and Montserrat are bundled through Fontsource with no browser requests to
Google. Montserrat also serves as the Cyrillic fallback where Poppins lacks glyphs.

Import `Button`, `Card`, `Badge`, `Input`, `StatCard`, `Select`, `Textarea`, and
`Modal` from `@/components/ui`.

- Button: `variant="primary" | "outlined" | "text"`, `disabled`, `loading`, and
  `loadingLabel`. Defaults to `type="button"`; use `type="submit"` for forms.
  Loading disables activation and exposes an accessible progress label.
- Card: padded white surface, 10px corners, divider border, and subtle web shadow.
- Badge: `variant="neutral" | "success" | "error"`, with 13px labels and 20px corners.
- Input: required `label`, optional `helperText` and `error`, native input attributes,
  and a forwarded ref. Labels, help, and errors are associated with the input.

All components accept `className`. The class-merging helper recognizes the custom
font-size tokens so text colors do not accidentally remove typography styles.

## API integration

```ts
import { listEvents, getEvent, ApiError } from "@/lib/api";

try {
  const events = await listEvents();
  const event = await getEvent(events[0].id);
} catch (error) {
  if (error instanceof ApiError) {
    // Inspect error.status, error.code, error.details, and error.requestId.
  }
}
```

Attendee, organizer, and admin helpers use native fetch through `/api/backend`. The gateway
allows only explicitly configured paths and HTTP methods, including organizer
POST/PUT/PATCH operations, and injects the request's Bearer token server-side.
Login stores the token in a short-lived HttpOnly, SameSite=Lax cookie (Secure on
HTTPS), so sessions survive reload without exposing tokens to browser JavaScript.
Cross-origin requests are rejected. Responses are not cached.

`AuthProvider` obtains the current user through `/api/auth/session`. Logout clears
the cookie; the current backend has no session revocation or refresh route.
Expired sessions require signing in again. The generic `createApiClient` remains
available for explicit server/client integrations, including optional Bearer
providers, FormData, file downloads, and structured `ApiError` handling.

Collections accept both current arrays and contract cursor envelopes. Aborted or
superseded requests do not overwrite the current UI. Both contract error objects
and FastAPI `detail` errors are supported. Checkout uses server totals and sends
idempotency keys, with no automatic payment retry. The current backend does not
yet enforce the contract's idempotency policy for these commands. Keys remain
stable on manual retries with unchanged payloads, and change if the payload changes.
There are no automatic mutation retries.

### Backend integration notes

- `POST /promo-codes/validate` prices the selection without reserving inventory;
  the event page shows "Code X applied" with the saving, and rejections (expired,
  disabled, exhausted, not applicable) display the backend message verbatim.
- Closing the checkout modal with a pending order calls
  `POST /checkout/sessions/{id}/cancel` (best effort) to release the hold.
- Confirmed orders are emailed with PDF tickets; the order page says so and offers
  **Resend tickets by email** (`POST /orders/{id}/resend-confirmation`).
- Still missing in the backend: owned ticket responses do not expose `order_id`
  (or `order_item_id`), so the order page shows totals and items but cannot list
  that order's tickets; tickets remain available under `/tickets`. It never assigns
  tickets to an order by guessing from event ID.

### Money and contract alignment

API amounts are safe integer minor units, with KZT exponent 2 by default.
`formatKZT(150000)` displays 1,500.00 KZT; it never converts request amounts.
A third argument can select a different configured currency exponent.

`src/types/api.ts` follows the draft contract status enums. Fields match existing
backend response schemas where provided. The standalone `PromoCode` DTO and image
object shape remain provisional because the contract does not define complete
responses. Current campaign responses embed their promo code directly.
TypeScript types do not validate server JSON at runtime.

Checkout uses the current backend's Order as its session representation. Public
organizer details are limited to `organizer_name` supplied by the event endpoint;
private payout/profile routes are not queried for public event pages.

## Checks

- `npm test`: token handling, errors, uploads/downloads, URL boundaries, money, and
  custom typography class merging; attendee filtering, inventory limits,
  pagination, promo requests, and calendar escaping/UTF-8 line folding; organizer
  lifecycle groups, weighted percentages, attributed revenue, exact KZT entry,
  explicit time-zone conversion, and implemented API query/mutation signatures;
  admin authorization, demo review rules/reset/idempotency, session restrictions,
  suspension visibility, partial metric coverage, and missing-route handling.
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run format:check`
- `npm run test:e2e` after building: Chrome browser checks against an isolated
  API fixture on ports 8011/3011. Includes discovery/retry/mobile layouts, sign-in
  basket retention, free checkout, discounted paid checkout, PDFs/calendars,
  invalid promos, sold-out inventory, expired reservations, failed payments,
  missing backend response fields, and cross-origin request rejection. This fixture
  models the proposed quote/order responses; passing it is not evidence that the
  current backend implements those additions. Installed Google Chrome is needed
  (Playwright `channel: "chrome"`). Screenshots/traces go in ignored `test-results`.
  Organizer tests also cover role denial, history groups, cancellation retries,
  duplication without transactions, missing banners, partial ticket saves,
  paid activation/fee failure, opaque QR links, refund invalidation, support
  reply failure and status changes, and preservation of unsent replies.
  Admin tests cover role denial (including demo mode), explicit live/demo modes,
  review decisions and reasons, event hiding, account/session restrictions,
  partial suspension retries, missing routes, and desktop/mobile layouts.

The scaffold currently inherits a development-only npm advisory chain through
`eslint-config-next` -> `fast-glob` -> `micromatch` -> `braces` (GHSA-vfj7-8cjw-p6xm).
The registry has no patched braces release; npm's proposed forced fix downgrades
Next's ESLint configuration to version 14, so it has not been applied. Production
runtime dependencies are checked separately with `npm audit --omit=dev`.
