"use client";
import { useCallback, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useApiData } from "@/hooks/useApiData";
import {
  getEventInventory,
  setTicketTypeHidden,
  updateTicketType,
} from "@/lib/api";
import { formatKZT } from "@/lib/money";
import { kazakhstanTime, localDateInput, parseKZT } from "@/lib/organizer";
import type { Event, InventoryTicketType, TicketTypeWrite } from "@/types/api";

/** Edit unsold draft ticket types; hide or restore any ticket type of an open event. */
export function TicketTypeManager({
  event,
  onChanged,
}: {
  event: Event;
  onChanged: () => void;
}) {
  const load = useCallback(
    (signal: AbortSignal) => getEventInventory(event.id, { signal }),
    [event.id],
  );
  const inventory = useApiData(load);
  const t = useTranslations("ticketTypes");
  const [editing, setEditing] = useState<InventoryTicketType | null>(null);
  const [hiding, setHiding] = useState<InventoryTicketType | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const open = ["draft", "published"].includes(event.status);

  function changed(message: string) {
    setNotice(message);
    inventory.retry();
    onChanged();
  }

  async function toggle(type: InventoryTicketType) {
    setBusy(type.id);
    setError(null);
    try {
      await setTicketTypeHidden(event.id, type.id, !type.is_hidden);
      setHiding(null);
      changed(
        type.is_hidden
          ? t("notices.visible", { name: type.name })
          : t("notices.hidden", { name: type.name }),
      );
    } catch (error) {
      setError(error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-lg" aria-labelledby="ticket-types-heading">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h2 id="ticket-types-heading" className="text-title">
          {t("heading")}
        </h2>
        <Button variant="text" onClick={inventory.retry}>
          {t("refresh")}
        </Button>
      </div>
      <p className="text-label text-text-secondary">{t("intro")}</p>
      {notice && (
        <p
          role="status"
          className="rounded-input border border-success/30 bg-success/5 p-md text-label"
        >
          {notice}
        </p>
      )}
      {!!error && !editing && !hiding && <ErrorState error={error} />}
      {inventory.loading ? (
        <LoadingSpinner label={t("loading")} />
      ) : inventory.error || !inventory.data ? (
        <ErrorState error={inventory.error} retry={inventory.retry} />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-label">
              <thead className="border-b border-divider bg-background text-text-secondary">
                <tr>
                  {[
                    t("columns.type"),
                    t("columns.price"),
                    t("columns.sold"),
                    t("columns.status"),
                    t("columns.actions"),
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-lg py-md font-medium"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventory.data.ticket_types.map((type) => (
                  <tr
                    key={type.id}
                    className="border-b border-divider last:border-0"
                  >
                    <td className="px-lg py-md">
                      <p className="font-medium">{type.name}</p>
                      {type.description && (
                        <p className="mt-xs text-text-secondary">
                          {type.description}
                        </p>
                      )}
                    </td>
                    <td className="px-lg py-md">
                      {type.kind === "free"
                        ? t("free")
                        : formatKZT(type.price_minor)}
                    </td>
                    <td className="px-lg py-md">
                      {type.sold_count} / {type.quantity}
                      {type.reserved_count > 0 && (
                        <span className="block text-text-secondary">
                          {t("onHold", { count: type.reserved_count })}
                        </span>
                      )}
                    </td>
                    <td className="px-lg py-md">
                      <Badge variant={type.is_hidden ? "error" : "success"}>
                        {type.is_hidden ? t("hidden") : t("onSale")}
                      </Badge>
                    </td>
                    <td className="px-lg py-md">
                      <div className="flex flex-wrap gap-sm">
                        <Button
                          variant="outlined"
                          className="px-sm text-label"
                          disabled={!type.editable || !!busy}
                          title={type.editable ? undefined : t("editDisabled")}
                          onClick={() => {
                            setError(null);
                            setEditing(type);
                          }}
                        >
                          {t("edit")}
                        </Button>
                        <Button
                          variant="text"
                          className="px-sm text-label"
                          disabled={!open || !!busy}
                          loading={busy === type.id}
                          onClick={() => {
                            setError(null);
                            if (type.is_hidden) void toggle(type);
                            else setHiding(type);
                          }}
                        >
                          {type.is_hidden ? t("restore") : t("hide")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!inventory.data.ticket_types.length && (
              <p className="p-lg text-label text-text-secondary">
                {t("empty")}
              </p>
            )}
          </div>
        </Card>
      )}
      {hiding && (
        <Modal
          title={t("hideModal.title")}
          busy={busy === hiding.id}
          onClose={() => setHiding(null)}
        >
          <p className="text-label">
            {t("hideModal.body", {
              name: hiding.name,
              count: hiding.sold_count,
            })}
          </p>
          {!!error && <ErrorState error={error} />}
          <Button
            className="w-full"
            loading={busy === hiding.id}
            onClick={() => toggle(hiding)}
          >
            {t("hideModal.confirm")}
          </Button>
        </Modal>
      )}
      {editing && inventory.data && (
        <EditTicketType
          eventId={event.id}
          type={editing}
          window={{
            opens: inventory.data.registration_opens_at,
            closes: inventory.data.registration_closes_at,
          }}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null);
            changed(t("notices.updated", { name }));
          }}
        />
      )}
    </section>
  );
}

function EditTicketType({
  eventId,
  type,
  window: registration,
  onClose,
  onSaved,
}: {
  eventId: string;
  type: InventoryTicketType;
  window: { opens: string; closes: string };
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const t = useTranslations("ticketTypes");
  const [kind, setKind] = useState(type.kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  function body(form: FormData): TicketTypeWrite {
    const quantity = Number(form.get("quantity"));
    const maximum = Number(form.get("maximum"));
    const start = kazakhstanTime(String(form.get("start")));
    const end = kazakhstanTime(String(form.get("end")));
    if (!Number.isSafeInteger(quantity) || quantity < 1)
      throw new Error(t("errors.quantity"));
    if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 50)
      throw new Error(t("errors.maximum"));
    if (Date.parse(start) >= Date.parse(end))
      throw new Error(t("errors.salesOrder"));
    if (
      Date.parse(start) < Date.parse(registration.opens) ||
      Date.parse(end) > Date.parse(registration.closes)
    )
      throw new Error(t("errors.salesWindow"));
    const price = kind === "free" ? 0 : parseKZT(String(form.get("price")));
    if (kind === "paid" && price <= 0) throw new Error(t("errors.paidPrice"));
    return {
      name: String(form.get("name")).trim(),
      description: String(form.get("description")).trim(),
      kind,
      price_minor: price,
      quantity,
      sales_start: start,
      sales_end: end,
      max_per_order: maximum,
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await updateTicketType(
        eventId,
        type.id,
        body(new FormData(event.currentTarget)),
      );
      onSaved(saved.name);
    } catch (error) {
      setError(error);
      setBusy(false);
    }
  }

  return (
    <Modal title={t("editModal.title")} busy={busy} onClose={onClose}>
      {!!error && <ErrorState error={error} />}
      <form onSubmit={submit} className="space-y-md">
        <Input
          label={t("editModal.name")}
          name="name"
          defaultValue={type.name}
          required
          maxLength={150}
          disabled={busy}
        />
        <Textarea
          label={t("editModal.description")}
          name="description"
          defaultValue={type.description}
          disabled={busy}
        />
        <div className="grid gap-md sm:grid-cols-2">
          <Select
            label={t("editModal.kind")}
            value={kind}
            onChange={(event) => setKind(event.target.value as "free" | "paid")}
            disabled={busy}
          >
            <option value="free">{t("editModal.kindFree")}</option>
            <option value="paid">{t("editModal.kindPaid")}</option>
          </Select>
          <Input
            label={t("editModal.price")}
            name="price"
            inputMode="decimal"
            defaultValue={
              type.kind === "paid" ? (type.price_minor / 100).toFixed(2) : "0"
            }
            disabled={busy || kind === "free"}
            required={kind === "paid"}
          />
          <Input
            label={t("editModal.quantity")}
            name="quantity"
            type="number"
            min={1}
            step={1}
            defaultValue={type.quantity}
            required
            disabled={busy}
          />
          <Input
            label={t("editModal.maximum")}
            name="maximum"
            type="number"
            min={1}
            max={50}
            step={1}
            defaultValue={type.max_per_order}
            required
            disabled={busy}
          />
          <Input
            label={t("editModal.salesStart")}
            name="start"
            type="datetime-local"
            defaultValue={localDateInput(type.sales_start)}
            required
            disabled={busy}
          />
          <Input
            label={t("editModal.salesEnd")}
            name="end"
            type="datetime-local"
            defaultValue={localDateInput(type.sales_end)}
            required
            disabled={busy}
          />
        </div>
        <p className="text-label text-text-secondary">
          {t("editModal.reviewNote")}
        </p>
        <Button type="submit" loading={busy} className="w-full">
          {t("editModal.save")}
        </Button>
      </form>
    </Modal>
  );
}
