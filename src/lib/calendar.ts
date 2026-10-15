import type { Event } from "@/types/api";

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
function timestamp(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error("The event contains an invalid calendar date.");
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}
/** RFC 5545 folding is by UTF-8 octets, without splitting a Unicode character. */
function fold(line: string) {
  const encoder = new TextEncoder();
  let output = "";
  let length = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (length + bytes > 75) {
      output += "\r\n ";
      length = 1;
    }
    output += character;
    length += bytes;
  }
  return output;
}
export function generateCalendar(
  event: Event,
  eventUrl: string,
  now = new Date(),
) {
  const url = new URL(eventUrl);
  if (!/^https?:$/.test(url.protocol))
    throw new Error("Event URLs must use HTTP or HTTPS.");
  const updated = event.updated_at ?? event.created_at;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BiletFlow//Attendee Web//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-TIMEZONE:${escapeText(event.time_zone)}`,
    "BEGIN:VEVENT",
    `UID:event-${event.id}@biletflow.kz`,
    `DTSTAMP:${timestamp(now)}`,
    `DTSTART:${timestamp(event.starts_at)}`,
    `DTEND:${timestamp(event.ends_at)}`,
    `LAST-MODIFIED:${timestamp(updated)}`,
    `SEQUENCE:${Math.max(0, Math.floor(Date.parse(updated) / 1000))}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(`${event.venue.name}, ${event.venue.address}`)}`,
    `URL:${url.href}`,
    `STATUS:${event.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];
  return lines.map(fold).join("\r\n");
}
export function downloadCalendar(event: Event) {
  const content = generateCalendar(
    event,
    new URL(`/events/${event.id}`, window.location.origin).href,
  );
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `biletflow-${event.id}.ics`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
