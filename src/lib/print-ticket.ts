import { getTicketPdf, getTicketQr } from "./api";
import { eventDate } from "./events";
import type { Event, Ticket, TicketType } from "@/types/api";

/** Open synchronously from the click, then populate with canonical backend files. */
export async function printTicket(
  ticket: Ticket,
  event: Event,
  type?: TicketType,
) {
  const preview = window.open("", "_blank", "width=850,height=900");
  if (!preview)
    throw new Error(
      "Your browser blocked the print preview. Allow pop-ups and try again.",
    );
  preview.opener = null;
  preview.document.title = `Ticket ${ticket.id} · BiletFlow`;
  preview.document.body.textContent = "Preparing your ticket…";
  const urls: string[] = [];
  try {
    const [qr, pdf] = await Promise.all([
      getTicketQr(ticket.id),
      getTicketPdf(ticket.id),
    ]);
    if (preview.closed) return;
    const qrUrl = URL.createObjectURL(qr);
    const pdfUrl = URL.createObjectURL(pdf);
    urls.push(qrUrl, pdfUrl);
    const doc = preview.document;
    doc.body.textContent = "";
    const style = doc.createElement("style");
    style.textContent =
      "body{font-family:Arial,sans-serif;color:#1d1d1d;background:#f8f8f8;margin:0;padding:32px}main{max-width:650px;margin:auto;background:white;border:1px solid #e7e7e7;border-radius:10px;padding:32px}h1{font-size:30px}img{display:block;width:260px;height:260px;margin:24px auto}p{line-height:1.6;overflow-wrap:anywhere}button,a{display:inline-block;margin:8px 12px 0 0;padding:12px 16px;font-size:14px;cursor:pointer}footer{font-size:13px} @page{size:A4;margin:20mm}@media print{body{background:white;padding:0}main{border:0;padding:0;max-width:none}nav{display:none}img{width:65mm;height:65mm}main{break-inside:avoid}}";
    doc.head.append(style);
    const main = doc.createElement("main");
    const text = (tag: string, value: string) => {
      const element = doc.createElement(tag);
      element.textContent = value;
      main.append(element);
    };
    text("h1", "BiletFlow · Admission ticket");
    text("h2", event.title);
    text("p", `${eventDate(event)} · ${event.time_zone}`);
    text("p", `${event.venue.name}, ${event.venue.address}`);
    text("p", `Attendee: ${ticket.attendee_name}`);
    text("p", `Ticket type: ${type?.name ?? "Admission"}`);
    const seat = [ticket.section, ticket.row, ticket.seat]
      .filter(Boolean)
      .join(" / ");
    if (seat) text("p", `Section / row / seat: ${seat}`);
    text("p", `Status: ${ticket.status.replace(/_/g, " ")}`);
    text("p", `Ticket ID: ${ticket.id}`);
    const image = doc.createElement("img");
    image.src = qrUrl;
    image.alt = `Admission QR code for ticket ${ticket.id}`;
    main.append(image);
    text(
      "footer",
      "Digital and printed copies share this ticket ID. Admission status is verified at the entrance.",
    );
    const actions = doc.createElement("nav");
    const print = doc.createElement("button");
    print.textContent = "Print / Save as PDF";
    print.disabled = true;
    image.onload = () => {
      print.disabled = false;
    };
    print.addEventListener("click", () => preview.print());
    const download = doc.createElement("a");
    download.href = pdfUrl;
    download.download = `biletflow-ticket-${ticket.id}.pdf`;
    download.textContent = "Download original PDF";
    actions.append(print, download);
    main.append(actions);
    doc.body.append(main);
    preview.addEventListener(
      "beforeunload",
      () => urls.forEach((url) => URL.revokeObjectURL(url)),
      { once: true },
    );
  } catch (error) {
    urls.forEach((url) => URL.revokeObjectURL(url));
    preview.close();
    throw error;
  }
}
