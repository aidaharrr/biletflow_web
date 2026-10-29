import { ApiError } from "./api";
import { canApproveOrganizer, hasAdminRole, isActiveEvent } from "./admin";
import type {
  AdminApi,
  AdminCampaign,
  AdminEvent,
  AdminSupportCase,
  AdminUser,
  OrganizerApplication,
  User,
} from "@/types/api";

export const ADMIN_DEMO_AS_OF = "2026-10-22T10:00:00.000Z";
const uid = (tail: string) =>
  `a1000000-0000-4000-8000-${tail.padStart(12, "0")}`;
const eid = (tail: string) =>
  `b2000000-0000-4000-8000-${tail.padStart(12, "0")}`;
function seed(actor: User) {
  const users: AdminUser[] = [
    { ...structuredClone(actor), is_active: true, active_sessions: 1 },
    {
      id: uid("1"),
      email: "team@steppe.example.com",
      full_name: "Steppe Events",
      roles: ["attendee", "organizer"],
      email_verified: true,
      is_active: true,
      active_sessions: 2,
      created_at: "2026-09-14T09:00:00Z",
    },
    {
      id: uid("2"),
      email: "studio@campus.example.com",
      full_name: "Campus Studio",
      roles: ["attendee"],
      email_verified: true,
      is_active: true,
      active_sessions: 1,
      created_at: "2026-10-04T09:00:00Z",
    },
    {
      id: uid("3"),
      email: "attendee@example.com",
      full_name: "Demo Attendee",
      roles: ["attendee"],
      email_verified: true,
      is_active: true,
      active_sessions: 3,
      created_at: "2026-10-10T09:00:00Z",
    },
    {
      id: uid("4"),
      email: "suspended@example.com",
      full_name: "Suspended Demo Account",
      roles: ["attendee"],
      email_verified: false,
      is_active: false,
      active_sessions: 0,
      suspension_reason: "Demonstration account restriction.",
      created_at: "2026-10-12T09:00:00Z",
    },
    {
      id: uid("5"),
      email: "staff@example.com",
      full_name: "Demo Event Staff",
      roles: ["event_admin"],
      email_verified: true,
      is_active: true,
      active_sessions: 1,
      created_at: "2026-10-15T09:00:00Z",
    },
  ];
  const event = (
    id: string,
    title: string,
    status: AdminEvent["status"],
    paid: AdminEvent["paid_sales_status"],
    day: string,
  ): AdminEvent => ({
    id: eid(id),
    organizer_id: uid("1"),
    organizer_name: "Steppe Events",
    venue_id: eid(`9${id}`),
    venue: { name: "Civic Hub", address: "10 Abay Avenue", city: "Almaty" },
    title,
    description: "Fictional event for the BiletFlow biweekly report.",
    category: "tech",
    images: [],
    visibility: "public",
    status,
    starts_at: `2026-11-${day}T13:00:00Z`,
    ends_at: `2026-11-${day}T17:00:00Z`,
    time_zone: "Asia/Almaty",
    registration_opens_at: "2026-10-01T04:00:00Z",
    registration_closes_at: `2026-11-${day}T12:00:00Z`,
    capacity: 100,
    admission_type: "general_admission",
    refund_policy: "Contact the demonstration organizer.",
    paid_sales_status: paid,
    available_ticket_types: [],
    created_at: "2026-10-15T09:00:00Z",
  });
  const events: AdminEvent[] = [
    event("1", "Almaty Tech Summit", "published", "active", "07"),
    event("2", "Campus Live", "published", "not_ready", "08"),
    {
      ...event("3", "Night Market", "draft", "suspended", "09"),
      moderation_status: "suspended",
      suspension_reason: "Venue information requires review.",
      suspended_at: "2026-10-21T09:00:00Z",
    },
    event("4", "Design Systems Lab", "draft", "not_ready", "12"),
  ];
  const application = (
    id: string,
    user: AdminUser,
    ready: boolean,
  ): OrganizerApplication => ({
    id: eid(`5${id}`),
    user_id: user.id,
    applicant_name: user.full_name!,
    email: user.email,
    organization_name: user.full_name!,
    contact_phone: null,
    requested_event_id: eid("4"),
    requested_event_title: "Design Systems Lab",
    profile: {
      id: eid(`6${id}`),
      user_id: user.id,
      contact_name: user.full_name!,
      organization_name: user.full_name!,
      contact_phone: null,
      verification_status: ready ? "verified" : "pending",
      payout_account_masked: ready ? "****1042" : null,
      payout_verified: ready,
    },
    sandbox_identity_reference: `sandbox-person-${id}`,
    sandbox_payout_reference: ready ? `sandbox-payout-${id}` : null,
    terms_accepted: ready,
    activation_fee_paid: ready,
    status: "pending",
    rejection_reason: null,
    reviewed_at: null,
    created_at: `2026-10-${ready ? "20" : "21"}T09:00:00Z`,
  });
  const applications = [
    application("1", users[1], true),
    {
      ...application("2", users[2], false),
      requested_event_id: null,
      requested_event_title: null,
    },
  ];
  const cases: AdminSupportCase[] = [
    {
      id: eid("71"),
      requester_id: uid("1"),
      requester_name: "Steppe Events",
      event_id: eid("4"),
      order_id: null,
      ticket_id: null,
      assigned_to: actor.id,
      subject: "Activation review needs follow-up",
      category: "account",
      status: "open",
      escalated: true,
      escalation_reason:
        "Sandbox verification exception needs platform review.",
      created_at: "2026-10-21T08:00:00Z",
      updated_at: "2026-10-22T08:00:00Z",
    },
    {
      id: eid("72"),
      requester_id: uid("3"),
      requester_name: "Demo Attendee",
      event_id: eid("1"),
      order_id: eid("81"),
      ticket_id: null,
      assigned_to: actor.id,
      subject: "Refund requires platform review",
      category: "refund",
      status: "in_progress",
      escalated: true,
      escalation_reason: "Organizer requested an independent review.",
      created_at: "2026-10-20T08:00:00Z",
      updated_at: "2026-10-22T09:00:00Z",
    },
    {
      id: eid("73"),
      requester_id: uid("2"),
      event_id: null,
      order_id: null,
      ticket_id: null,
      assigned_to: actor.id,
      subject: "Resolved sandbox account question",
      category: "account",
      status: "resolved",
      escalated: true,
      created_at: "2026-10-18T08:00:00Z",
      updated_at: "2026-10-19T08:00:00Z",
    },
  ];
  const campaigns: AdminCampaign[] = [
    {
      id: eid("71"),
      event_id: events[0].id,
      event_title: events[0].title,
      name: "University partners",
      code: "CAMPUS20",
      discount_type: "percentage",
      discount_value: 20,
      state: "active",
      visits: 412,
      redemptions: 37,
      maximum: 100,
      created_at: "2026-10-01T09:00:00Z",
    },
    {
      id: eid("72"),
      event_id: events[1].id,
      event_title: events[1].title,
      name: "Early birds",
      code: "EARLY5000",
      discount_type: "fixed_kzt",
      discount_value: 500_000,
      state: "exhausted",
      visits: 96,
      redemptions: 50,
      maximum: 50,
      created_at: "2026-09-20T09:00:00Z",
    },
  ];
  return { users, events, applications, cases, campaigns };
}
function requireReason(reason: string) {
  const value = reason.trim();
  if (value.length < 3 || value.length > 500)
    throw new ApiError(
      "Enter a reason from 3 to 500 characters.",
      422,
      "VALIDATION_ERROR",
    );
  return value;
}
/** Explicit, isolated report state. Never called as a fallback for a failed live request. */
export function createAdminDemoApi(
  actor: User,
): AdminApi & { reset: () => void } {
  if (!hasAdminRole(actor))
    throw new ApiError("An Admin account is required.", 403, "FORBIDDEN");
  let state = seed(actor);
  const ledger = new Map<string, { signature: string; result: unknown }>();
  async function read<T>(data: () => T, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    await Promise.resolve();
    signal?.throwIfAborted();
    return structuredClone(data());
  }
  async function mutate<T>(
    key: string,
    signature: string,
    action: () => T,
  ): Promise<T> {
    if (!key)
      throw new ApiError(
        "An idempotency key is required.",
        422,
        "VALIDATION_ERROR",
      );
    const previous = ledger.get(key);
    if (previous) {
      if (previous.signature !== signature)
        throw new ApiError(
          "This retry key was already used for different details.",
          409,
          "IDEMPOTENCY_CONFLICT",
        );
      return structuredClone(previous.result) as T;
    }
    const result = action();
    ledger.set(key, { signature, result: structuredClone(result) });
    return structuredClone(result);
  }
  function find<T extends { id: string }>(rows: T[], id: string): T {
    const found = rows.find((row) => row.id === id);
    if (!found)
      throw new ApiError(
        "The sample record could not be found.",
        404,
        "NOT_FOUND",
      );
    return found;
  }
  function target(id: string) {
    if (id === actor.id)
      throw new ApiError(
        "You cannot restrict your own administrator account.",
        409,
        "SELF_RESTRICTION",
      );
    return find(state.users, id);
  }
  const api: AdminApi & { reset: () => void } = {
    reset: () => {
      state = seed(actor);
      ledger.clear();
    },
    getDashboard: (options) =>
      read(() => {
        const escalated = state.cases.filter(
          (item) => item.escalated && item.status !== "resolved",
        );
        return {
          total_registered_users: state.users.length,
          active_events: state.events.filter((event) =>
            isActiveEvent(event, Date.parse(ADMIN_DEMO_AS_OF)),
          ).length,
          pending_organizer_applications: state.applications.filter(
            (app) => app.status === "pending",
          ).length,
          escalated_support_cases: escalated.length,
          escalated_cases: escalated,
          issues: [],
          as_of: ADMIN_DEMO_AS_OF,
        };
      }, options?.signal),
    getOrganizerApplications: (options) =>
      read(() => state.applications, options?.signal),
    getPendingOrganizers: (options) =>
      read(
        () =>
          state.applications.filter(
            (application) => application.status === "pending",
          ),
        options?.signal,
      ),
    approveOrganizer: (id, key) =>
      mutate(key, `approve:${id}`, () => {
        const app = find(state.applications, id);
        if (!canApproveOrganizer(app))
          throw new ApiError(
            "The application must be pending with all sandbox checks complete.",
            409,
            "APPLICATION_NOT_READY",
          );
        app.status = "approved";
        app.reviewed_at = new Date().toISOString();
        const user = find(state.users, app.user_id);
        if (!user.roles.includes("organizer")) user.roles.push("organizer");
        return app;
      }),
    rejectOrganizer: (id, reason, key) =>
      mutate(key, `reject:${id}:${reason}`, () => {
        const value = requireReason(reason);
        const app = find(state.applications, id);
        if (app.status !== "pending")
          throw new ApiError(
            "This application has already been reviewed.",
            409,
            "APPLICATION_ALREADY_REVIEWED",
          );
        app.status = "rejected";
        app.rejection_reason = value;
        app.reviewed_at = new Date().toISOString();
        return app;
      }),
    getCampaigns: (options) =>
      read(
        () =>
          state.campaigns.filter(
            (campaign) =>
              !options?.query ||
              [campaign.code, campaign.event_title].some((value) =>
                value.toLowerCase().includes(options.query!.toLowerCase()),
              ),
          ),
        options?.signal,
      ),
    getEvents: (options) =>
      read(
        () =>
          state.events.filter(
            (event) =>
              !options?.query ||
              event.title.toLowerCase().includes(options.query.toLowerCase()),
          ),
        options?.signal,
      ),
    suspendEvent: (id, reason, key) =>
      mutate(key, `event:${id}:${reason}`, () => {
        const value = requireReason(reason);
        const event = find(state.events, id);
        event.status = "draft";
        event.paid_sales_status = "suspended";
        event.moderation_status = "suspended";
        event.suspension_reason = value;
        event.suspended_at = new Date().toISOString();
        return {
          status: "suspended",
          event_id: id,
          event_hidden: true,
          paid_sales_stopped: true,
        };
      }),
    getUsers: (options) =>
      read(
        () =>
          state.users.filter(
            (user) =>
              !options?.query ||
              [user.email, user.full_name ?? ""].some((value) =>
                value.toLowerCase().includes(options.query!.toLowerCase()),
              ),
          ),
        options?.signal,
      ),
    suspendUser: (id, reason, key) =>
      mutate(key, `user:${id}:${reason}`, () => {
        const value = requireReason(reason);
        const user = target(id);
        if (!user.is_active)
          throw new ApiError(
            "This account is already suspended.",
            409,
            "ACCOUNT_SUSPENDED",
          );
        user.is_active = false;
        user.active_sessions = 0;
        user.suspension_reason = value;
        return { status: "suspended" };
      }),
    revokeUserAccess: (id, reason, key) =>
      mutate(key, `revoke:${id}:${reason}`, () => {
        requireReason(reason);
        const user = target(id);
        if (!user.is_active)
          throw new ApiError(
            "This account is suspended.",
            409,
            "ACCOUNT_SUSPENDED",
          );
        const count = user.active_sessions ?? 0;
        user.active_sessions = 0;
        user.last_access_revoked_at = new Date().toISOString();
        return { status: "revoked", user_id: id, revoked_sessions: count };
      }),
  };
  return api;
}
