import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  localeFromHeader,
} from "./config";
import { MESSAGES } from "./messages";

export async function resolveLocale() {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return (
    localeFromHeader((await headers()).get("accept-language")) ?? DEFAULT_LOCALE
  );
}

type Tree = { [key: string]: string | Tree };

/** English underneath, so a key missing in kk or ru shows English instead of the key name. */
function withEnglishFallback(base: Tree, override: Tree): Tree {
  const out: Tree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const below = out[key];
    out[key] =
      typeof value === "object" && typeof below === "object"
        ? withEnglishFallback(below, value)
        : value;
  }
  return out;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: withEnglishFallback(
      MESSAGES.en as Tree,
      MESSAGES[locale] as Tree,
    ),
    timeZone: "Asia/Almaty",
  };
});
