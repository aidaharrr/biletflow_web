"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { ApiError } from "@/lib/api";
import { useAdmin } from "./AdminShell";
export function AdminHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const t = useTranslations("admin.AdminStates");
  return (
    <header className="flex flex-wrap items-start justify-between gap-lg">
      <div className="min-w-0 space-y-sm">
        <p className="text-label uppercase tracking-widest text-primary">
          {t("eyebrow")}
        </p>
        <h1 className="font-brand text-3xl font-semibold">{title}</h1>
        <p className="max-w-3xl text-label text-text-secondary">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}
export function AdminErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const t = useTranslations("admin.AdminStates");
  const { mode } = useAdmin();
  const path = usePathname();
  const forbidden =
    error instanceof ApiError && [401, 403].includes(error.status);
  return (
    <div className="space-y-md">
      <ErrorState error={error} retry={retry} />
      {mode === "live" && !forbidden && (
        <Link
          href={`${path}?mode=demo`}
          className="inline-flex min-h-button items-center font-medium underline"
        >
          {t("previewDemo")}
        </Link>
      )}
      {error instanceof ApiError && error.status === 401 && (
        <Link
          href={`/login?next=${encodeURIComponent(path)}`}
          className="inline-block underline"
        >
          {t("signInAgain")}
        </Link>
      )}
    </div>
  );
}
