import { getLocale } from "next-intl/server";
import { intlLocale } from "./config";
import { translateError, translateLabel } from "./dictionaries";

/** Server-component versions of the hooks in ./labels. */
export async function getLabel() {
  const locale = await getLocale();
  return (english: string) => translateLabel(locale, english);
}
export async function getErrorText() {
  const locale = await getLocale();
  return (message: string | undefined | null) => translateError(locale, message);
}
export async function getIntlLocale() {
  return intlLocale(await getLocale());
}
