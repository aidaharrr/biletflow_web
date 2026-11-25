import type { Locale } from "@/types/api";
import kkErrors from "../../messages/kk/errors.json";
import kkLabels from "../../messages/kk/labels.json";
import ruErrors from "../../messages/ru/errors.json";
import ruLabels from "../../messages/ru/labels.json";

type Dictionary = Record<string, string>;

/**
 * Lookups keyed by the exact English text, for strings that are not written in
 * components: values returned by src/lib helpers ("Sold out", "Active") and error
 * messages from the API client, the gateway and the FastAPI backend. English needs
 * no file: the key is the English text. Unknown text is shown unchanged.
 */
const DICTIONARIES: Record<Locale, { labels: Dictionary; errors: Dictionary }> =
  {
    en: { labels: {}, errors: {} },
    ru: { labels: ruLabels, errors: ruErrors },
    kk: { labels: kkLabels, errors: kkErrors },
  };

const lowerCaseLabels = new Map(
  (["ru", "kk"] as const).map((locale) => [
    locale,
    new Map(
      Object.entries(DICTIONARIES[locale].labels).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    ),
  ]),
);

/** Exact match first, then case-insensitive (API categories arrive as "tech", "music"). */
export function translateLabel(locale: string, english: string): string {
  const labels = DICTIONARIES[locale as Locale]?.labels;
  if (!labels) return english;
  return (
    labels[english] ??
    lowerCaseLabels
      .get(locale as "ru" | "kk")
      ?.get(english.trim().toLowerCase()) ??
    english
  );
}

/**
 * Backend messages built with f-strings. Each pattern captures the variable parts
 * (codes, names, statuses), which are kept as they are.
 */
const PATTERNS: [RegExp, Record<"ru" | "kk", string>][] = [
  [
    /^Ticket status is (\S+)$/,
    { ru: "Статус билета: $1", kk: "Билет мәртебесі: $1" },
  ],
  [
    /^Promo code (.+) has been disabled by the organizer\.$/,
    {
      ru: "Промокод $1 отключён организатором.",
      kk: "$1 промокодын ұйымдастырушы өшірді.",
    },
  ],
  [
    /^Promo code (.+) is not active yet\.$/,
    {
      ru: "Промокод $1 ещё не действует.",
      kk: "$1 промокоды әлі жарамды емес.",
    },
  ],
  [
    /^Promo code (.+) has expired\.$/,
    {
      ru: "Срок действия промокода $1 истёк.",
      kk: "$1 промокодының мерзімі өтті.",
    },
  ],
  [
    /^Promo code (.+) has reached its redemption limit\.$/,
    {
      ru: "Промокод $1 больше нельзя использовать: лимит исчерпан.",
      kk: "$1 промокодының қолдану лимиті таусылды.",
    },
  ],
  [
    /^Promo code (.+) is not valid for this event\.$/,
    {
      ru: "Промокод $1 не действует для этого мероприятия.",
      kk: "$1 промокоды бұл іс-шараға жарамайды.",
    },
  ],
  [
    /^Promo code (.+) does not apply to the selected tickets\.$/,
    {
      ru: "Промокод $1 не распространяется на выбранные билеты.",
      kk: "$1 промокоды таңдалған билеттерге қолданылмайды.",
    },
  ],
  [
    /^Promo code (.+) is already in use$/,
    {
      ru: "Промокод $1 уже используется",
      kk: "$1 промокоды бұрыннан қолданыста",
    },
  ],
  [
    /^Sales for (.+) are closed$/,
    { ru: "Продажа билетов «$1» закрыта", kk: "«$1» билеттерін сату жабық" },
  ],
  [
    /^You can buy at most (\d+) (.+)$/,
    {
      ru: "Можно купить не больше $1 шт. «$2»",
      kk: "«$2» билетін ең көбі $1 дана сатып алуға болады",
    },
  ],
  [
    /^Maximum redemptions cannot be lower than the (\d+) already used$/,
    {
      ru: "Лимит использований не может быть меньше уже использованных ($1)",
      kk: "Қолдану лимиті қолданылып қойған саннан ($1) аз болмауы керек",
    },
  ],
  [
    /^Tickets sent to (.+)$/,
    { ru: "Билеты отправлены на $1", kk: "Билеттер $1 мекенжайына жіберілді" },
  ],
  [
    /^Request failed \((\d{3})\)\.$/,
    { ru: "Запрос не выполнен ($1).", kk: "Сұраныс орындалмады ($1)." },
  ],
];

function translateOne(
  locale: "ru" | "kk",
  errors: Dictionary,
  raw: string,
): string | undefined {
  const text = raw.trim().replace(/^Value error, /, "");
  const exact =
    errors[text] ?? errors[text.replace(/\.$/, "")] ?? errors[`${text}.`];
  if (exact) return exact;
  for (const [pattern, out] of PATTERNS)
    if (pattern.test(text)) return text.replace(pattern, out[locale]);
  return undefined;
}

export function translateError(
  locale: string,
  message: string | undefined | null,
): string {
  if (!message) return "";
  if (locale !== "ru" && locale !== "kk") return message;
  const errors = DICTIONARIES[locale].errors;
  const whole = translateOne(locale, errors, message);
  if (whole) return whole;
  // Several field errors joined with ". " by errorMessage() in src/lib/api.ts.
  const parts = message.split(/\.\s+/);
  if (parts.length < 2) return message;
  let changed = false;
  const out = parts.map((part) => {
    const done = translateOne(locale, errors, part);
    if (done) changed = true;
    return done?.replace(/\.$/, "") ?? part;
  });
  return changed ? out.join(". ") : message;
}
