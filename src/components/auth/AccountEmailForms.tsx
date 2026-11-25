"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/i18n/labels";
import { Button, Card, Input } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { User } from "@/types/api";
import { authGatewayClient, useAuth } from "./AuthProvider";

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[32rem] px-md py-12">
      <Card className="space-y-lg">
        <h1 className="font-brand text-2xl font-semibold">{title}</h1>
        {children}
      </Card>
    </main>
  );
}

export function VerifyEmail({ token }: { token: string }) {
  const { user, refresh } = useAuth();
  const t = useTranslations("auth");
  const [state, setState] = useState<{
    status: "pending" | "verified" | "failed";
    error?: unknown;
  }>({ status: token ? "pending" : "failed" });
  // Refs survive Strict Mode's simulated remount, so the token is submitted once.
  const started = useRef(false);
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authGatewayClient()
      .post<User>("verify-email", { token })
      .then(async () => {
        setState({ status: "verified" });
        await refresh();
      })
      .catch((error) => setState({ status: "failed", error }));
  }, [token, refresh]);
  if (state.status === "pending")
    return <LoadingSpinner label={t("VerifyEmail.verifying")} />;
  if (state.status === "verified")
    return (
      <Shell title={t("VerifyEmail.verifiedTitle")}>
        <p role="status" className="text-text-secondary">
          {t("VerifyEmail.verifiedBody")}
        </p>
        <Link
          href={user ? "/events" : "/login"}
          className="block rounded-button bg-primary px-5 py-3.5 text-center font-medium text-white"
        >
          {user ? t("VerifyEmail.continueToEvents") : t("VerifyEmail.signIn")}
        </Link>
      </Shell>
    );
  return (
    <Shell title={t("VerifyEmail.invalidTitle")}>
      {state.error ? (
        <ErrorState error={state.error} />
      ) : (
        <p className="text-error">{t("VerifyEmail.missingToken")}</p>
      )}
      <p className="text-label text-text-secondary">
        {t("VerifyEmail.expiryHint")}
      </p>
      <Link href="/login" className="font-medium underline">
        {t("VerifyEmail.goToSignIn")}
      </Link>
    </Shell>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const errorText = useErrorText();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    setPending(true);
    setError(null);
    try {
      const result = await authGatewayClient().post<{ message: string }>(
        "forgot-password",
        { email },
      );
      setSent(
        result?.message
          ? errorText(result.message)
          : t("ForgotPassword.sentFallback"),
      );
    } catch (error) {
      setError(error);
    } finally {
      setPending(false);
    }
  }
  return (
    <Shell title={t("ForgotPassword.title")}>
      {sent ? (
        <>
          <p role="status" className="text-text-secondary">
            {sent} {t("ForgotPassword.linkExpiry")}
          </p>
          <Link href="/login" className="font-medium underline">
            {t("ForgotPassword.backToSignIn")}
          </Link>
        </>
      ) : (
        <>
          <p className="text-label text-text-secondary">
            {t("ForgotPassword.intro")}
          </p>
          {!!error && <ErrorState error={error} />}
          <form onSubmit={submit} className="space-y-lg">
            <Input
              label={t("ForgotPassword.email")}
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={pending}
            />
            <Button type="submit" className="w-full" loading={pending}>
              {t("ForgotPassword.submit")}
            </Button>
          </form>
          <Link href="/login" className="text-label underline">
            {t("ForgotPassword.backToSignIn")}
          </Link>
        </>
      )}
    </Shell>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) {
      setError(new Error(t("ResetPassword.mismatch")));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await authGatewayClient().post("reset-password", { token, password });
      setDone(true);
    } catch (error) {
      setError(error);
    } finally {
      setPending(false);
    }
  }
  if (!token)
    return (
      <Shell title={t("ResetPassword.invalidTitle")}>
        <p className="text-error">{t("ResetPassword.missingToken")}</p>
        <Link href="/forgot-password" className="font-medium underline">
          {t("ResetPassword.requestNewLink")}
        </Link>
      </Shell>
    );
  if (done)
    return (
      <Shell title={t("ResetPassword.doneTitle")}>
        <p role="status" className="text-text-secondary">
          {t("ResetPassword.doneBody")}
        </p>
        <Link
          href="/login"
          className="block rounded-button bg-primary px-5 py-3.5 text-center font-medium text-white"
        >
          {t("ResetPassword.signIn")}
        </Link>
      </Shell>
    );
  return (
    <Shell title={t("ResetPassword.title")}>
      {!!error && (
        <>
          <ErrorState error={error} />
          <Link href="/forgot-password" className="text-label underline">
            {t("ResetPassword.requestNewLink")}
          </Link>
        </>
      )}
      <form onSubmit={submit} className="space-y-lg">
        <Input
          label={t("ResetPassword.newPassword")}
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          disabled={pending}
          helperText={t("ResetPassword.passwordHelper")}
        />
        <Input
          label={t("ResetPassword.confirmPassword")}
          name="confirm"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          disabled={pending}
        />
        <Button type="submit" className="w-full" loading={pending}>
          {t("ResetPassword.submit")}
        </Button>
      </form>
    </Shell>
  );
}

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const t = useTranslations("auth");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!user || user.email_verified) return null;
  async function resend() {
    setPending(true);
    setError(null);
    try {
      await authGatewayClient().post("resend-verification", {
        email: user!.email,
      });
      setSent(true);
    } catch (error) {
      setError(error);
    } finally {
      setPending(false);
    }
  }
  return (
    <div
      role="region"
      aria-label={t("VerificationBanner.region")}
      className="border-b border-primary/30 bg-primary/5 print:hidden"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-md px-md py-sm text-label sm:px-lg lg:px-xl">
        <p>
          {sent ? (
            <span role="status">
              {t.rich("VerificationBanner.sent", {
                email: user.email,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </span>
          ) : (
            <>
              {t.rich("VerificationBanner.prompt", {
                email: user.email,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </>
          )}
        </p>
        {!sent && (
          <Button
            variant="text"
            className="text-label"
            loading={pending}
            loadingLabel={t("VerificationBanner.sending")}
            onClick={resend}
          >
            {t("VerificationBanner.resend")}
          </Button>
        )}
        {!!error && (
          <div className="w-full">
            <ErrorState error={error} />
          </div>
        )}
      </div>
    </div>
  );
}
