"use client";
import { useCallback, useMemo, useState } from "react";
import { Input, Button } from "@/components/ui";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { EventCard } from "@/components/events/EventCard";
import { listEvents } from "@/lib/api";
import { categoryFilters, filterEvents } from "@/lib/events";
import { useApiData } from "@/hooks/useApiData";
import { cn } from "@/lib/cn";
import { useTranslations } from "next-intl";
import { useLabel } from "@/i18n/labels";

const FIXED_CATEGORIES = new Set(categoryFilters.map((filter) => filter.label));

export default function EventsPage() {
  const t = useTranslations("events");
  const label = useLabel();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const load = useCallback((signal: AbortSignal) => listEvents({ signal }), []);
  const { data: events, error, loading, retry } = useApiData(load);
  const categories = useMemo(
    () => [
      ...categoryFilters.map((filter) => filter.label),
      ...Array.from(
        new Set((events ?? []).map((event) => event.category)),
      ).filter(
        (value) =>
          !categoryFilters.some((filter) =>
            filter.values.includes(value.toLowerCase()),
          ),
      ),
    ],
    [events],
  );
  const filtered = filterEvents(events ?? [], search, category);
  return (
    <main className="mx-auto max-w-7xl space-y-xl px-md py-xl sm:px-lg lg:px-xl">
      <header className="max-w-2xl space-y-md">
        <p className="text-label font-medium uppercase tracking-widest text-primary">
          {t("EventsPage.eyebrow")}
        </p>
        <h1 className="font-brand text-3xl font-semibold sm:text-4xl">
          {t("EventsPage.title")}
        </h1>
        <p className="text-text-secondary">{t("EventsPage.subtitle")}</p>
      </header>
      <section aria-label={t("EventsPage.filterAria")} className="space-y-lg">
        <Input
          label={t("EventsPage.searchLabel")}
          type="search"
          placeholder={t("EventsPage.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          containerClassName="max-w-[36rem]"
        />
        <div
          className="flex flex-wrap gap-sm"
          aria-label={t("EventsPage.categoriesAria")}
        >
          {categories.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
              className={cn(
                "rounded-badge border border-divider bg-surface px-5 py-sm text-label capitalize transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                category === value && "border-primary bg-primary text-white",
              )}
            >
              {FIXED_CATEGORIES.has(value)
                ? t(`EventsPage.categories.${value}`)
                : label(value)}
            </button>
          ))}
        </div>
      </section>
      {loading ? (
        <LoadingSpinner label={t("EventsPage.loading")} />
      ) : error ? (
        <ErrorState error={error} retry={retry} />
      ) : (
        <section
          aria-label={t("EventsPage.resultsAria")}
          className="space-y-lg"
        >
          <p role="status" className="text-label text-text-secondary">
            {t("EventsPage.found", { count: filtered.length })}
          </p>
          {filtered.length ? (
            <div className="grid gap-lg sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="space-y-md rounded-card border border-divider bg-surface p-xl text-center">
              <h2 className="text-title">{t("EventsPage.emptyTitle")}</h2>
              <p className="text-text-secondary">{t("EventsPage.emptyBody")}</p>
              <Button
                variant="outlined"
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                }}
              >
                {t("EventsPage.clearFilters")}
              </Button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
