// Live admin fixture intentionally implements only routes present in the Python backend.
export function createAdminFixture({ events, control, user }) {
  const users = [
    {
      id: "d3000000-0000-4000-8000-000000000001",
      email: "target@example.com",
      full_name: "Target User",
      roles: ["attendee"],
      email_verified: true,
      is_active: true,
      created_at: "2026-10-01T09:00:00Z",
    },
    {
      id: "d3000000-0000-4000-8000-000000000002",
      email: "disabled@example.com",
      full_name: "Disabled User",
      roles: ["attendee"],
      email_verified: true,
      is_active: false,
      created_at: "2026-10-01T09:00:00Z",
    },
  ];
  return function handle({ path, url, request, send }) {
    const unpublish =
      /^\/events\/[^/]+\/unpublish$/.test(path) &&
      user.roles.includes("platform_admin");
    if (!path.startsWith("/admin/") && !unpublish) return false;
    if (request.headers.authorization !== "Bearer fixture-token") {
      send({ detail: "Not authenticated" }, 401);
      return true;
    }
    if (!user.roles.includes("platform_admin")) {
      send({ detail: "Admin required" }, 403);
      return true;
    }
    const parts = path.split("/");
    if (unpublish) {
      if (control.adminHideError) {
        control.adminHideError = false;
        send({ detail: "Event hiding temporarily unavailable" }, 503);
        return true;
      }
      const event = events.find((event) => event.id === parts[2]);
      if (!event) send({ detail: "Not found" }, 404);
      else {
        event.status = "draft";
        send(event);
      }
      return true;
    }
    if (path === "/admin/users") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      send(
        [{ ...user, is_active: true }, ...users].filter((user) =>
          user.email.toLowerCase().includes(q),
        ),
      );
      return true;
    }
    if (path === "/admin/events") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      send(events.filter((event) => event.title.toLowerCase().includes(q)));
      return true;
    }
    if (path === "/admin/reports/operations") {
      send({
        users: 3,
        events: events.length,
        orders: 0,
        tickets: 0,
        currency: "KZT",
        financial_data_is_simulated: true,
      });
      return true;
    }
    if (/^\/admin\/events\/[^/]+\/suspend$/.test(path)) {
      if (control.adminSuspendError) {
        control.adminSuspendError = false;
        send({ detail: "Sales suspension failed" }, 503);
        return true;
      }
      const event = events.find((event) => event.id === parts[3]);
      if (!event) send({ detail: "Not found" }, 404);
      else {
        event.paid_sales_status = "suspended";
        send({ status: "suspended" });
      }
      return true;
    }
    if (/^\/admin\/users\/[^/]+\/suspend$/.test(path)) {
      if (parts[3] === user.id)
        send({ detail: "Cannot suspend current administrator" }, 409);
      else {
        const target = users.find((user) => user.id === parts[3]);
        if (!target) send({ detail: "Not found" }, 404);
        else {
          target.is_active = false;
          send({ status: "suspended" });
        }
      }
      return true;
    }
    send({ detail: "Not Found" }, 404);
    return true;
  };
}
