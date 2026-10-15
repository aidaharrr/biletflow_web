"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, Input } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { ApiError, createApiClient } from "@/lib/api";
import { useAuth } from "./AuthProvider";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const query = useSearchParams();
  const { refresh } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
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
          preferred_locale: "en",
        });
      await client.post("login", credentials);
      await refresh();
      router.push(destination);
    } catch (error) {
      setError(
        error instanceof ApiError && error.status === 401
          ? new Error("Invalid email or password. Please try again.")
          : error,
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="mx-auto max-w-[32rem] px-md py-12">
      <Card className="space-y-lg">
        <h1 className="font-brand text-2xl font-semibold">
          {registering ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-label text-text-secondary">
          {registering
            ? "Keep your events and tickets together."
            : "Sign in to book tickets and view your orders."}
        </p>
        {!!error && <ErrorState error={error} />}
        <form onSubmit={submit} className="space-y-lg">
          {registering && (
            <Input
              label="Full name"
              name="name"
              required
              minLength={2}
              maxLength={200}
              autoComplete="name"
              disabled={pending}
            />
          )}
          <Input
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={pending}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            required
            minLength={registering ? 8 : undefined}
            maxLength={128}
            autoComplete={registering ? "new-password" : "current-password"}
            disabled={pending}
          />
          <Button type="submit" className="w-full" loading={pending}>
            {registering ? "Create account" : "Sign in"}
          </Button>
        </form>
        <p className="text-label text-text-secondary">
          {registering ? "Already have an account? " : "New to BiletFlow? "}
          <Link
            className="font-medium text-text-primary underline"
            href={`/${registering ? "login" : "register"}?next=${encodeURIComponent(destination)}`}
          >
            {registering ? "Sign in" : "Register"}
          </Link>
        </p>
      </Card>
    </main>
  );
}
