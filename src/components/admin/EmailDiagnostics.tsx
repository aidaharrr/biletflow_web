"use client";
import { useCallback, useState, type FormEvent } from "react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useApiData } from "@/hooks/useApiData";
import {
  getEmailStatus,
  sendTestEmail,
  type EmailDiagnostics,
} from "@/lib/api";

/** Shows why verification emails may not arrive and sends a synchronous test email. */
export function EmailDiagnosticsCard() {
  const load = useCallback(
    (signal: AbortSignal) => getEmailStatus({ signal }),
    [],
  );
  const status = useApiData(load);
  const [result, setResult] = useState<EmailDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function test(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const to = String(new FormData(event.currentTarget).get("to")).trim();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await sendTestEmail(to || null));
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-md">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h2 className="text-title">Email delivery</h2>
        {status.data && (
          <Badge variant={status.data.problems.length ? "error" : "success"}>
            {status.data.backend} ·{" "}
            {status.data.problems.length ? "needs attention" : "configured"}
          </Badge>
        )}
      </div>
      {status.loading ? (
        <LoadingSpinner label="Checking email configuration…" />
      ) : status.error || !status.data ? (
        <ErrorState error={status.error} retry={status.retry} />
      ) : (
        <>
          <p className="break-all text-label text-text-secondary">
            Sender: {status.data.sender || "not set"}
          </p>
          {status.data.problems.length > 0 && (
            <ul className="list-disc space-y-xs pl-lg text-label text-error">
              {status.data.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </>
      )}
      <form
        onSubmit={test}
        className="grid items-end gap-md sm:grid-cols-[1fr_auto]"
      >
        <Input
          label="Send a test email to (blank = your admin email)"
          name="to"
          type="email"
          disabled={busy}
        />
        <Button type="submit" variant="outlined" loading={busy}>
          Send test email
        </Button>
      </form>
      {!!error && <ErrorState error={error} />}
      {result && (
        <p
          role="status"
          className={`whitespace-pre-wrap break-words rounded-input border p-md text-label ${result.delivered ? "border-success/30 bg-success/5" : "border-error/30 bg-error/5 text-error"}`}
        >
          {result.delivered ? "Accepted by the provider. " : "Not delivered. "}
          {result.detail}
        </p>
      )}
    </Card>
  );
}
