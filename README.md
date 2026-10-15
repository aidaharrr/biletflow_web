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
  Ticket quantities and a campaign promo survive the sign-in redirect.
- `/campaign/[token]`: resolve an opaque campaign token before opening its event.

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
  redemption limits and validity dates, confirmed-order discount/revenue totals,
  and server-generated campaign QR download. Share links contain only an opaque
  campaign token. Campaign QR images are explicitly labeled as non-admission.
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
minor units. Campaign discount/revenue columns aggregate confirmed authoritative
orders by `campaign_id`; they include processing fees in attributed revenue and
exclude refunded, pending, and failed orders. Definitions are shown in the UI.

Organizer integration gaps in the inspected backend:

1. Banner attachment is documented but not implemented. The frontend attempts
   `POST /events/{id}/images` with `{ url }`, a proposed URL attachment payload.
   The wizard preserves the saved draft and offers retry or explicit continuation
   without the image. No banner is claimed to have been saved on failure.
2. `GET /organizer/analytics/ticket-types` is documented but not implemented.
   The proposed DTO is `TicketTypeAnalytics` in `src/types/api.ts`; it requires
   `ticket_type_id`, `tickets_sold`, `gross_sales_minor`, and `currency`, with
   optional discount/refund/net amounts. Until available, inventory counts remain
   visible and revenue is marked unavailable rather than inferred from prices.
3. The current cancellation route ignores a submitted reason; the UI sends it,
   but recording that reason in audit history requires backend support. The current
   duplication route does not copy ticket types, so the wizard materializes the
   visible source configuration as new records at its ticket step. Managed-event
   responses omit hidden ticket types, so their inventory and duplication require
   a fuller authorized backend response.
4. The backend summary counts ticket-type quantities as capacity and sums only
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

Attendee and organizer helpers use native fetch through `/api/backend`. The gateway
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

### Backend additions required

The frontend was built against the SRS and inspected current backend source. Two
pieces are absent from the existing backend and were not changed in this task:

1. `POST /api/v1/promo-codes/validate`, a read-only quote endpoint taking
   `{ event_id, items: [{ ticket_type_id, quantity }], promo_code: string | null }`.
   It should reuse checkout rules without reserving inventory or consuming a
   promo redemption. Its response needs integer `subtotal_minor`,
   `discount_minor`, `processing_fee_minor`, `total_minor`, `currency: "KZT"`,
   and `promo_code: string | null`. An optional `is_simulation` is supported.
2. Owned order responses must include `items` and issued `tickets`, or expose
   `order_id` on owned ticket responses. The current schemas omit the order's
   line items and all ticket-to-order associations. The preferred order shape
   is `Order` in `src/types/api.ts`, including `items: OrderItem[]` and
   `tickets: Ticket[]` (one canonical ticket per attendee/seat).

Until the quote route exists, the frontend shows an estimated subtotal and
displays validated discounts and the final total in the existing checkout
reservation response. Invalid codes still fail on the server. Until order
associations exist, confirmation shows totals but explains that itemized tickets
are unavailable. It never assigns tickets to an order by guessing from event ID.
QR and PDF downloads use existing authenticated `/tickets/{id}/qr` and `/pdf`.

Closing a reserved checkout follows the backend's existing hold expiry policy;
there is no current cancellation endpoint. Reclaiming expired inventory is a
backend responsibility. The frontend prevents confirmation once the hold expires.

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
  explicit time-zone conversion, and implemented API query/mutation signatures.
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

The scaffold currently inherits a development-only npm advisory chain through
`eslint-config-next` -> `fast-glob` -> `micromatch` -> `braces` (GHSA-vfj7-8cjw-p6xm).
The registry has no patched braces release; npm's proposed forced fix downgrades
Next's ESLint configuration to version 14, so it has not been applied. Production
runtime dependencies are checked separately with `npm audit --omit=dev`.
