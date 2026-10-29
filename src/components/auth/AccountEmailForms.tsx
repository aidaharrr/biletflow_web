"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
    return <LoadingSpinner label="Verifying your email…" />;
  if (state.status === "verified")
    return (
      <Shell title="Email verified">
        <p role="status" className="text-text-secondary">
          Thank you. Your email address is confirmed.
        </p>
        <Link
          href={user ? "/events" : "/login"}
          className="block rounded-button bg-primary px-5 py-3.5 text-center font-medium text-white"
        >
          {user ? "Continue to events" : "Sign in"}
        </Link>
      </Shell>
    );
  return (
    <Shell title="Verification link not valid">
      {state.error ? (
        <ErrorState error={state.error} />
      ) : (
        <p className="text-error">
          This verification link is missing its token.
        </p>
      )}
      <p className="text-label text-text-secondary">
        Links expire after 24 hours. Sign in and use “Resend verification email”
        to get a new one.
      </p>
      <Link href="/login" className="font-medium underline">
        Go to sign in
      </Link>
    </Shell>
  );
}

export function ForgotPasswordForm() {
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
      setSent(result?.message ?? "If the account exists, we sent an email.");
    } catch (error) {
      setError(error);
    } finally {
      setPending(false);
    }
  }
  return (
    <Shell title="Reset your password">
      {sent ? (
        <>
          <p role="status" className="text-text-secondary">
            {sent} The link expires in 30 minutes and can be used once.
          </p>
          <Link href="/login" className="font-medium underline">
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <p className="text-label text-text-secondary">
            Enter your account email and we will send you a reset link.
          </p>
          {!!error && <ErrorState error={error} />}
          <form onSubmit={submit} className="space-y-lg">
            <Input
              label="Email"
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={pending}
            />
            <Button type="submit" className="w-full" loading={pending}>
              Send reset link
            </Button>
          </form>
          <Link href="/login" className="text-label underline">
            Back to sign in
          </Link>
        </>
      )}
    </Shell>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) {
      setError(new Error("The passwords do not match."));
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
      <Shell title="Reset link not valid">
        <p className="text-error">This reset link is missing its token.</p>
        <Link href="/forgot-password" className="font-medium underline">
          Request a new link
        </Link>
      </Shell>
    );
  if (done)
    return (
      <Shell title="Password changed">
        <p role="status" className="text-text-secondary">
          Your password was updated and other sessions were signed out.
        </p>
        <Link
          href="/login"
          className="block rounded-button bg-primary px-5 py-3.5 text-center font-medium text-white"
        >
          Sign in
        </Link>
      </Shell>
    );
  return (
    <Shell title="Choose a new password">
      {!!error && (
        <>
          <ErrorState error={error} />
          <Link href="/forgot-password" className="text-label underline">
            Request a new link
          </Link>
        </>
      )}
      <form onSubmit={submit} className="space-y-lg">
        <Input
          label="New password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          disabled={pending}
          helperText="At least 8 characters."
        />
        <Input
          label="Confirm new password"
          name="confirm"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          disabled={pending}
        />
        <Button type="submit" className="w-full" loading={pending}>
          Update password
        </Button>
      </form>
    </Shell>
  );
}

export function EmailVerificationBanner() {
  const { user } = useAuth();
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
      aria-label="Email verification"
      className="border-b border-primary/30 bg-primary/5 print:hidden"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-md px-md py-sm text-label sm:px-lg lg:px-xl">
        <p>
          {sent ? (
            <span role="status">
              Verification email sent to <strong>{user.email}</strong>. Check
              your inbox.
            </span>
          ) : (
            <>
              Please verify <strong>{user.email}</strong>. Organizers must
              verify before publishing events.
            </>
          )}
        </p>
        {!sent && (
          <Button
            variant="text"
            className="text-label"
            loading={pending}
            loadingLabel="Sending"
            onClick={resend}
          >
            Resend verification email
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
