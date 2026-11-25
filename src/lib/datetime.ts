const KK_MONTHS = [
  "қаң.",
  "ақп.",
  "нау.",
  "сәу.",
  "мам.",
  "мау.",
  "шіл.",
  "там.",
  "қыр.",
  "қаз.",
  "қар.",
  "жел.",
];

/**
 * Medium date + short time ("2 Dec 2026, 20:31"). Chrome ships no Kazakh month names
 * (it prints "2026 M12 2") while Node does, so Kazakh is formatted by hand here to look
 * the same on the server and in every browser.
 */
export function mediumDateTime(
  value: Date,
  locale: string,
  timeZone: string,
): string {
  if (locale.toLowerCase().startsWith("kk")) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(value)
        .map((part) => [part.type, part.value]),
    );
    return `${Number(parts.day)} ${KK_MONTHS[Number(parts.month) - 1]} ${parts.year} ж., ${parts.hour}:${parts.minute}`;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
}
