"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES } from "@/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("nav");
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label={t("language")}
      value={locale}
      disabled={pending}
      onChange={(event) => {
        document.cookie = `${LOCALE_COOKIE}=${event.target.value}; path=/; max-age=31536000; samesite=lax`;
        startTransition(() => router.refresh());
      }}
      className="rounded-md border border-divider bg-surface px-sm py-xs text-label"
    >
      {LOCALES.map((code) => (
        <option key={code} value={code}>
          {LOCALE_NAMES[code]}
        </option>
      ))}
    </select>
  );
}
