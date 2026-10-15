import type { Event, TicketType } from "@/types/api";
import { formatKZT } from "./money";

export const categoryFilters = [
  { label: "All", values: [] },
  { label: "Concerts", values: ["concert", "concerts", "music"] },
  { label: "Tech", values: ["tech", "technology", "conference"] },
  { label: "Student", values: ["student", "students", "education"] },
  { label: "Sports", values: ["sport", "sports"] },
];

export function filterEvents(
  events: Event[],
  search: string,
  category: string,
) {
  const query = search.trim().toLocaleLowerCase();
  const selected = categoryFilters.find((filter) => filter.label === category);
  return events.filter((event) => {
    const matchesQuery = [
      event.title,
      event.venue.name,
      event.venue.address,
      event.venue.city ?? "",
    ].some((value) => value.toLocaleLowerCase().includes(query));
    const value = event.category.toLocaleLowerCase();
    const matchesCategory =
      category === "All" ||
      (selected
        ? selected.values.includes(value)
        : value === category.toLocaleLowerCase());
    return (
      event.visibility === "public" &&
      event.status === "published" &&
      matchesQuery &&
      matchesCategory
    );
  });
}

export function eventDate(event: Pick<Event, "starts_at" | "time_zone">) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: event.time_zone,
  }).format(new Date(event.starts_at));
}

export function priceRange(types: TicketType[]) {
  const prices = types
    .filter((type) => !type.is_hidden)
    .map((type) => type.price_minor);
  if (!prices.length) return "Tickets coming soon";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const price = (value: number) => (value === 0 ? "Free" : formatKZT(value));
  return min === max ? price(min) : `${price(min)} – ${price(max)}`;
}

export function ticketAvailability(
  type: TicketType,
  event: Event,
  now = Date.now(),
) {
  const remaining = Math.max(
    0,
    type.quantity - type.reserved_count - type.sold_count,
  );
  let reason: string | null = null;
  if (event.status !== "published") reason = "Registration unavailable";
  else if (now < Date.parse(event.registration_opens_at))
    reason = "Registration opens soon";
  else if (now > Date.parse(event.registration_closes_at))
    reason = "Registration closed";
  else if (type.is_hidden) reason = "Unavailable";
  else if (now < Date.parse(type.sales_start)) reason = "Sales open soon";
  else if (now > Date.parse(type.sales_end)) reason = "Sales ended";
  else if (type.kind === "paid" && event.paid_sales_status !== "active")
    reason = "Paid sales unavailable";
  else if (remaining === 0) reason = "Sold out";
  return {
    remaining,
    limit: reason ? 0 : Math.min(remaining, type.max_per_order),
    reason,
  };
}
