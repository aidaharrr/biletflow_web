import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import { EventBanner } from "./EventBanner";
import { eventDate, priceRange } from "@/lib/events";
import type { Event } from "@/types/api";

export function EventCard({ event }: { event: Event }) {
  return (
    <Card className="overflow-hidden p-0 transition-shadow hover:shadow-lg">
      <Link
        href={`/events/${event.id}`}
        className="block h-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <EventBanner event={event} className="aspect-[16/9]" />
        <div className="space-y-md p-lg">
          <Badge className="capitalize">{event.category}</Badge>
          <h2 className="text-title">{event.title}</h2>
          <p className="text-label text-text-secondary">
            <time dateTime={event.starts_at}>{eventDate(event)}</time>
          </p>
          <p className="text-label text-text-secondary">
            {event.venue.name}
            {event.venue.city ? ` · ${event.venue.city}` : ""}
          </p>
          <p className="border-t border-divider pt-md font-medium">
            {priceRange(event.available_ticket_types)}
          </p>
        </div>
      </Link>
    </Card>
  );
}
