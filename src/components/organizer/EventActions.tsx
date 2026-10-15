"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button, Modal, Textarea } from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { cancelEvent, duplicateEvent } from "@/lib/api";
import type { Event } from "@/types/api";
export function EventActions({
  event,
  onChanged,
}: {
  event: Event;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [cancel, setCancel] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const key = useRef<{ signature: string; value: string } | null>(null);
  function requestKey(signature: string) {
    if (key.current?.signature !== signature)
      key.current = { signature, value: crypto.randomUUID() };
    return key.current.value;
  }
  async function duplicate() {
    setBusy("duplicate");
    setError(null);
    try {
      const draft = await duplicateEvent(
        event.id,
        requestKey(`duplicate:${event.id}`),
      );
      router.push(
        `/organizer/events/create?draft=${draft.id}&source=${event.id}`,
      );
    } catch (error) {
      setError(error);
      setBusy(null);
    }
  }
  async function confirmCancel(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    const reason = String(
      new FormData(submit.currentTarget).get("reason"),
    ).trim();
    if (reason.length < 3) {
      setError(new Error("Please provide a cancellation reason."));
      return;
    }
    setBusy("cancel");
    setError(null);
    try {
      await cancelEvent(
        event.id,
        reason,
        requestKey(`cancel:${event.id}:${reason}`),
      );
      setCancel(false);
      key.current = null;
      onChanged();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-sm">
      <div className="flex flex-wrap items-center gap-sm text-label">
        <Link
          href={`/organizer/events/${event.id}`}
          className="rounded-input px-sm py-3 font-medium underline"
        >
          View Analytics
        </Link>
        <Link
          href={`/organizer/events/${event.id}#attendees`}
          className="rounded-input px-sm py-3 font-medium underline"
        >
          Manage Attendees
        </Link>
        <Button
          variant="text"
          className="px-sm text-label"
          loading={busy === "duplicate"}
          disabled={!!busy}
          onClick={duplicate}
        >
          Duplicate Event
        </Button>
        <Button
          variant="text"
          className="px-sm text-label text-error"
          disabled={!!busy || ["cancelled", "completed"].includes(event.status)}
          onClick={() => {
            key.current = null;
            setError(null);
            setCancel(true);
          }}
        >
          Cancel Event
        </Button>
      </div>
      {!!error && !cancel && <ErrorState error={error} />}{" "}
      {cancel && (
        <Modal
          title="Cancel this event?"
          busy={!!busy}
          onClose={() => {
            setCancel(false);
            setError(null);
            key.current = null;
          }}
        >
          <p className="text-label text-text-secondary">
            Cancel {event.title} and stop further sales. Existing orders remain
            in the event history. Review refund requests separately.
          </p>
          {!!error && <ErrorState error={error} />}
          <form onSubmit={confirmCancel} className="space-y-lg">
            <Textarea
              label="Cancellation reason"
              name="reason"
              required
              minLength={3}
              maxLength={500}
              disabled={!!busy}
            />
            <Button
              type="submit"
              loading={busy === "cancel"}
              className="w-full bg-error"
            >
              Confirm cancellation
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
