"use client";

import { useLocale } from "next-intl";
import { intlLocale } from "./config";
import { translateError, translateLabel } from "./dictionaries";

/**
 * Helpers in src/lib return fixed English strings ("Sold out", "Active", "Free", …) and
 * unit tests rely on them. Show them through useLabel(); show any error message
 * (thrown Error, ApiError, backend `detail`) through useErrorText(). Both fall back to
 * the English text when there is no translation.
 */
export function useLabel() {
  const locale = useLocale();
  return (english: string) => translateLabel(locale, english);
}

export function useErrorText() {
  const locale = useLocale();
  return (message: string | undefined | null) => translateError(locale, message);
}

/** Intl tag ("kk-KZ", "ru-KZ", "en-GB") for lib formatters such as formatKZT and eventDate. */
export function useIntlLocale() {
  return intlLocale(useLocale());
}
