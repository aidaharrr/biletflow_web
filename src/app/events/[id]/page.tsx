import { EventDetails } from "@/components/events/EventDetails";
import type { CheckoutItem } from "@/types/api";
export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ promo?: string | string[]; tickets?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  let items: CheckoutItem[] = [];
  if (typeof query.tickets === "string") {
    try {
      const parsed: unknown = JSON.parse(query.tickets);
      if (Array.isArray(parsed) && parsed.length <= 100)
        items = parsed.filter(
          (item): item is CheckoutItem =>
            typeof item?.ticket_type_id === "string" &&
            /^[\da-f-]{36}$/i.test(item.ticket_type_id) &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0 &&
            item.quantity <= 50,
        );
    } catch {
      /* Invalid URL baskets start empty. Server validation remains authoritative. */
    }
  }
  return (
    <EventDetails
      key={`${id}:${JSON.stringify(items)}:${typeof query.promo === "string" ? query.promo : ""}`}
      id={id}
      initialPromoCode={typeof query.promo === "string" ? query.promo : ""}
      initialItems={items}
    />
  );
}
