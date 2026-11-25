"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Navbar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const t = useTranslations("nav");
  return (
    <header className="border-b border-divider bg-surface print:hidden">
      <nav
        aria-label={t("Navbar.mainNavigation")}
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-md px-md py-md sm:px-lg lg:px-xl"
      >
        <Link
          href="/events"
          aria-label={t("Navbar.home")}
          className="font-brand text-2xl font-extrabold tracking-tight"
        >
          <span className="text-primary">Bilet</span>Flow
        </Link>
        <div className="order-3 flex w-full flex-wrap gap-lg text-label font-medium sm:order-none sm:w-auto">
          <Link
            href="/events"
            aria-current={pathname.startsWith("/events") ? "page" : undefined}
            className={cn(
              "py-sm hover:text-primary",
              pathname.startsWith("/events") && "text-primary",
            )}
          >
            {t("Navbar.events")}
          </Link>
          <Link
            href="/tickets"
            aria-current={pathname === "/tickets" ? "page" : undefined}
            className={cn(
              "py-sm hover:text-primary",
              pathname === "/tickets" && "text-primary",
            )}
          >
            {t("Navbar.myTickets")}
          </Link>
          {user?.roles.includes("organizer") && (
            <Link
              href="/organizer/dashboard"
              className="py-sm font-medium text-primary md:hidden"
            >
              {t("Navbar.organizerPortal")}
            </Link>
          )}
          {user &&
            !user.roles.includes("organizer") &&
            !user.roles.includes("platform_admin") && (
              <Link
                href="/become-organizer"
                aria-current={
                  pathname === "/become-organizer" ? "page" : undefined
                }
                className={cn(
                  "py-sm hover:text-primary",
                  pathname === "/become-organizer" && "text-primary",
                )}
              >
                {t("Navbar.becomeOrganizer")}
              </Link>
            )}
          {user?.roles.includes("platform_admin") && (
            <Link
              href="/admin/dashboard"
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              className="py-sm font-medium text-primary"
            >
              {t("Navbar.adminPanel")}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-md text-label">
          <LanguageSwitcher />
          {user?.roles.includes("organizer") && (
            <Link
              href="/organizer/dashboard"
              className="hidden font-medium text-primary md:inline-block"
            >
              {t("Navbar.organizerPortal")}
            </Link>
          )}
          {loading ? (
            <span className="text-text-secondary" role="status">
              {t("Navbar.checkingSession")}
            </span>
          ) : user ? (
            <Link
              href="/tickets"
              className="rounded-button border border-divider px-md py-3 font-medium hover:border-primary"
            >
              {user.full_name || t("Navbar.myProfile")}
            </Link>
          ) : (
            <>
              <Link href="/login" className="font-medium hover:text-primary">
                {t("Navbar.login")}
              </Link>
              <Link
                href="/register"
                className="rounded-button bg-primary px-md py-3 font-medium text-white hover:brightness-95"
              >
                {t("Navbar.register")}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
