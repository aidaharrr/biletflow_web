import type { Locale } from "@/types/api";

export const LOCALES = ["kk", "ru", "en"] as const satisfies readonly Locale[];
/** Same default as the mobile app. Browsers that ask for en or ru get that instead. */
export const DEFAULT_LOCALE: Locale = "kk";
export const LOCALE_COOKIE = "bf_locale";

export const LOCALE_NAMES: Record<Locale, string> = {
  kk: "Қазақша",
  ru: "Русский",
  en: "English",
};

/** BCP 47 tag for Intl date and number formatting. */
export function intlLocale(locale: string | undefined): string {
  if (locale === "kk") return "kk-KZ";
  if (locale === "ru") return "ru-KZ";
  return "en-GB";
}

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/** Picks the best supported locale from an Accept-Language header. */
export function localeFromHeader(header: string | null): Locale | undefined {
  if (!header) return undefined;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.find((item) => isLocale(item.lang))?.lang as Locale | undefined;
}
