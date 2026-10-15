/** JSON transport types: UUID strings, ISO 8601 timestamps, integer KZT minor units.
 * Status unions follow docs/API_CONTRACT.md, not the initial SQL enums.
 * Fields follow implemented response schemas where the draft leaves them unspecified.
 */
export type UUID = string;
export type ISODateTime = string;
/** Must be a safe integer; never send a floating-point KZT amount to the API. */
export type MinorUnits = number;
export type Currency = "KZT";
export type Locale = "kk" | "ru" | "en";
export const KZT_MINOR_UNIT_EXPONENT = 2;

export type UserRole =
  "attendee" | "organizer" | "event_admin" | "platform_admin";
export type VerificationStatus =
  "not_started" | "pending" | "verified" | "rejected";
export type EventVisibility = "public" | "unlisted" | "private";
export type EventStatus = "draft" | "published" | "cancelled" | "completed";
export type PaidSalesStatus = "not_ready" | "ready" | "active" | "suspended";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "partially_refunded"
  | "refunded"
  | "payment_failed"
  | "expired";
export type TicketStatus = "valid" | "checked_in" | "cancelled" | "refunded";
export type PaymentStatus =
  "pending" | "succeeded" | "failed" | "cancelled" | "refunded";
export type RefundStatus = "pending" | "succeeded" | "failed";
export type SupportStatus =
  "open" | "in_progress" | "waiting_for_customer" | "resolved";
export type SupportCategory =
  | "ticket_delivery"
  | "payment"
  | "refund"
  | "seating"
  | "event_information"
  | "check_in"
  | "account"
  | "technical";
export type DiscountType = "percentage" | "fixed_kzt";

export interface Money {
  amount: MinorUnits;
  currency: Currency;
}

export interface User {
  id: UUID;
  email: string;
  roles: UserRole[];
  email_verified: boolean;
  full_name?: string | null;
  phone?: string | null;
  preferred_locale?: Locale;
  is_active?: boolean;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
}

export interface OrganizerProfile {
  id: UUID;
  user_id: UUID;
  contact_name: string;
  organization_name: string | null;
  contact_phone: string | null;
  verification_status: VerificationStatus;
  payout_account_masked: string | null;
  payout_verified: boolean;
}

export interface Venue {
  name: string;
  address: string;
  city?: string;
}

export interface EventImage {
  id: UUID;
  url: string;
  alt?: string;
}

export interface Event {
  id: UUID;
  organizer_id: UUID;
  organizer_name: string;
  venue_id: UUID;
  venue: Venue;
  title: string;
  description: string;
  category: string;
  images: (EventImage | string)[];
  visibility: EventVisibility;
  status: EventStatus;
  starts_at: ISODateTime;
  ends_at: ISODateTime;
  time_zone: string;
  registration_opens_at: ISODateTime;
  registration_closes_at: ISODateTime;
  capacity: number;
  admission_type: "general_admission" | "assigned_seating";
  venue_layout_id?: UUID | null;
  refund_policy: string;
  paid_sales_status: PaidSalesStatus;
  available_ticket_types: TicketType[];
  created_at: ISODateTime;
  updated_at?: ISODateTime;
}

export interface TicketType {
  id: UUID;
  event_id: UUID;
  name: string;
  description: string;
  kind: "free" | "paid";
  price_minor: MinorUnits;
  currency: Currency;
  quantity: number;
  reserved_count: number;
  sold_count: number;
  refunded_count: number;
  sales_start: ISODateTime;
  sales_end: ISODateTime;
  max_per_order: number;
  is_hidden: boolean;
  price_category?: string | null;
}

export interface OrderItem {
  id: UUID;
  ticket_type_id: UUID;
  quantity: number;
  unit_price_minor: MinorUnits;
  discount_minor: MinorUnits;
}

export interface Order {
  id: UUID;
  event_id: UUID;
  user_id: UUID | null;
  attendee_name: string;
  attendee_email: string;
  status: OrderStatus;
  currency: Currency;
  subtotal_minor: MinorUnits;
  discount_minor: MinorUnits;
  processing_fee_minor: MinorUnits;
  total_minor: MinorUnits;
  expires_at: ISODateTime;
  campaign_id: UUID | null;
  items?: OrderItem[];
  tickets?: Ticket[];
  created_at: ISODateTime;
  updated_at?: ISODateTime;
}

export interface Ticket {
  id: UUID;
  order_id?: UUID;
  order_item_id?: UUID;
  event_id: UUID;
  ticket_type_id: UUID;
  attendee_name: string;
  attendee_email: string;
  qr_credential: string;
  status: TicketStatus;
  section: string | null;
  row: string | null;
  seat: string | null;
  issued_at?: ISODateTime | null;
}

/** Draft DTO: a standalone promo-code response is not yet implemented. */
export interface PromoCode {
  id: UUID;
  campaign_id: UUID;
  code: string;
  redemption_count: number;
  created_at?: ISODateTime;
}

/** Implemented campaigns currently embed their generated promo code. */
export interface PromotionalCampaign {
  id: UUID;
  event_id: UUID;
  name: string;
  code: string;
  opaque_token: string;
  discount_type: DiscountType;
  /** Percentage points for percentage; integer minor units for fixed_kzt. */
  discount_value: number;
  valid_from: ISODateTime;
  valid_until: ISODateTime;
  max_redemptions: number;
  redemption_count: number;
  enabled: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface SupportCase {
  id: UUID;
  requester_id: UUID;
  event_id: UUID | null;
  order_id: UUID | null;
  ticket_id: UUID | null;
  assigned_to: UUID | null;
  subject: string;
  category: SupportCategory;
  status: SupportStatus;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface SupportMessage {
  id: UUID;
  case_id: UUID;
  sender_id: UUID;
  body: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface AuditLog {
  id: UUID;
  actor_id: UUID | null;
  event_id: UUID | null;
  action: string;
  entity_type: string;
  entity_id: string;
  description: string;
  data: Record<string, unknown>;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface PaginatedResponse<T> {
  items: T[];
  next_cursor: string | null;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    request_id?: string;
  };
}

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: User;
}

export interface CheckoutItem {
  ticket_type_id: UUID;
  quantity: number;
}

export interface CheckoutRequest {
  event_id: UUID;
  items: CheckoutItem[];
  attendee_name: string;
  attendee_email: string;
  promo_code?: string;
}

export interface CheckoutQuote {
  subtotal_minor: MinorUnits;
  discount_minor: MinorUnits;
  processing_fee_minor: MinorUnits;
  total_minor: MinorUnits;
  currency: Currency;
  promo_code: string | null;
  is_simulation?: boolean;
}

export interface EventWrite {
  title: string;
  description: string;
  category: string;
  visibility: EventVisibility;
  venue: Venue;
  starts_at: ISODateTime;
  ends_at: ISODateTime;
  time_zone: string;
  registration_opens_at: ISODateTime;
  registration_closes_at: ISODateTime;
  capacity: number;
  admission_type: "general_admission";
  refund_policy: string;
}
export type TicketTypeWrite = Pick<
  TicketType,
  | "name"
  | "description"
  | "kind"
  | "price_minor"
  | "quantity"
  | "sales_start"
  | "sales_end"
  | "max_per_order"
>;
export type CampaignWrite = Pick<
  PromotionalCampaign,
  | "name"
  | "code"
  | "discount_type"
  | "discount_value"
  | "valid_from"
  | "valid_until"
  | "max_redemptions"
>;
export interface PaidSalesChecklist {
  status: PaidSalesStatus;
  checklist: {
    has_paid_ticket: boolean;
    identity_verified: boolean;
    payout_connected: boolean;
    activation_fee_paid: boolean;
    terms_accepted: boolean;
  };
  can_activate: boolean;
  is_simulation: boolean;
}
export interface OrganizerSummary {
  event_id: UUID;
  capacity: number;
  tickets_sold: number;
  tickets_remaining: number;
  percentage_sold: number;
  gross_sales_minor: MinorUnits;
  discounts_minor: MinorUnits;
  refunds_minor: MinorUnits;
  net_revenue_minor: MinorUnits;
  currency: Currency;
  checked_in: number;
  absent: number;
  check_in_percentage: number;
  is_simulation: boolean;
}
export interface SalesPoint {
  date: string;
  orders: number;
  revenue_minor: MinorUnits;
  currency: Currency;
}
/** Proposed response for the contract's currently unimplemented ticket-type analytics. */
export interface TicketTypeAnalytics {
  ticket_type_id: UUID;
  name?: string;
  tickets_sold: number;
  gross_sales_minor: MinorUnits;
  discounts_minor?: MinorUnits;
  refunds_minor?: MinorUnits;
  net_revenue_minor?: MinorUnits;
  currency: Currency;
}
/** Current history endpoint uses timestamp rather than created_at. */
export interface ActivityEntry {
  id: UUID;
  timestamp: ISODateTime;
  actor_id: UUID | null;
  actor_name?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  description: string;
}
export interface RefundResult {
  id: UUID;
  status: RefundStatus;
  amount_minor: MinorUnits;
  currency: Currency;
  is_simulation: boolean;
}
export interface ActivationFeeResult {
  status: PaymentStatus;
  amount_minor: MinorUnits;
  currency: Currency;
  is_simulation: boolean;
}
export interface SupportCaseWrite {
  subject: string;
  category: SupportCategory;
  message: string;
  event_id?: UUID;
  order_id?: UUID;
  ticket_id?: UUID;
}
