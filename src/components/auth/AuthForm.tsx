"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Card, Input } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { ApiError, createApiClient } from "@/lib/api";
import type { Locale } from "@/types/api";
import { useAuth } from "./AuthProvider";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const query = useSearchParams();
  const { refresh } = useAuth();
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const registering = mode === "register";
  const requested = query.get("next") ?? "/events";
  const destination =
    requested.startsWith("/") &&
    !requested.startsWith("//") &&
    !requested.includes("\\")
      ? requested
      : "/events";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const client = createApiClient({
        baseUrl: new URL("/api/auth", window.location.origin).href,
      });
      const credentials = {
        email: String(data.get("email")).trim(),
        password: String(data.get("password")),
      };
      if (registering)
        await client.post("register", {
          ...credentials,
          full_name: String(data.get("name")).trim(),
          preferred_locale: locale,
        });
      await client.post("login", credentials);
      await refresh();
      if (registering) {
        setRegisteredEmail(credentials.email);
        return;
      }
      router.push(destination);
    } catch (error) {
      setError(
        error instanceof ApiError && error.status === 401
          ? new Error(t("AuthForm.invalidCredentials"))
          : error,
      );
    } finally {
      setPending(false);
    }
  }
  if (registeredEmail)
    return (
      <main className="mx-auto max-w-[32rem] px-md py-12">
        <Card className="space-y-lg">
          <h1 className="font-brand text-2xl font-semibold">
            {t("AuthForm.checkEmailTitle")}
          </h1>
          <p role="status" className="text-text-secondary">
            {t.rich("AuthForm.accountReady", {
              email: registeredEmail,
              strong: (chunks) => (
                <strong className="text-text-primary">{chunks}</strong>
              ),
            })}
          </p>
          <Link
            href={destination}
            className="block rounded-button bg-primary px-5 py-3.5 text-center font-medium text-white"
          >
            {t("AuthForm.continue")}
          </Link>
        </Card>
      </main>
    );
  return (
    <main className="mx-auto max-w-[32rem] px-md py-12">
      <Card className="space-y-lg">
        <h1 className="font-brand text-2xl font-semibold">
          {registering ? t("AuthForm.registerTitle") : t("AuthForm.loginTitle")}
        </h1>
        <p className="text-label text-text-secondary">
          {registering
            ? t("AuthForm.registerSubtitle")
            : t("AuthForm.loginSubtitle")}
        </p>
        {!!error && <ErrorState error={error} />}
        <form onSubmit={submit} className="space-y-lg">
          {registering && (
            <Input
              label={t("AuthForm.fullName")}
              name="name"
              required
              minLength={2}
              maxLength={200}
              autoComplete="name"
              disabled={pending}
            />
          )}
          <Input
            label={t("AuthForm.email")}
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={pending}
          />
          <Input
            label={t("AuthForm.password")}
            name="password"
            type="password"
            required
            minLength={registering ? 8 : undefined}
            maxLength={128}
            autoComplete={registering ? "new-password" : "current-password"}
            disabled={pending}
          />
          {!registering && (
            <p className="text-right text-label">
              <Link href="/forgot-password" className="underline">
                {t("AuthForm.forgotPassword")}
              </Link>
            </p>
          )}
          <Button type="submit" className="w-full" loading={pending}>
            {registering ? t("AuthForm.createAccount") : t("AuthForm.signIn")}
          </Button>
        </form>
        <p className="text-label text-text-secondary">
          {registering
            ? t("AuthForm.haveAccount")
            : t("AuthForm.newToBiletFlow")}{" "}
          <Link
            className="font-medium text-text-primary underline"
            href={`/${registering ? "login" : "register"}?next=${encodeURIComponent(destination)}`}
          >
            {registering ? t("AuthForm.signIn") : t("AuthForm.register")}
          </Link>
        </p>
      </Card>
    </main>
  );
}
