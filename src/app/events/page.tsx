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

export default function EventsPage() {
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
          Make plans. Make memories.
        </p>
        <h1 className="font-brand text-3xl font-semibold sm:text-4xl">
          Find your next experience.
        </h1>
        <p className="text-text-secondary">
          Discover events, meet your community, and be there for what matters.
        </p>
      </header>
      <section aria-label="Filter events" className="space-y-lg">
        <Input
          label="Search events"
          type="search"
          placeholder="Search by event or venue"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          containerClassName="max-w-[36rem]"
        />
        <div className="flex flex-wrap gap-sm" aria-label="Event categories">
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
              {value}
            </button>
          ))}
        </div>
      </section>
      {loading ? (
        <LoadingSpinner label="Finding events…" />
      ) : error ? (
        <ErrorState error={error} retry={retry} />
      ) : (
        <section aria-label="Event results" className="space-y-lg">
          <p role="status" className="text-label text-text-secondary">
            {filtered.length} {filtered.length === 1 ? "event" : "events"} found
          </p>
          {filtered.length ? (
            <div className="grid gap-lg sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="space-y-md rounded-card border border-divider bg-surface p-xl text-center">
              <h2 className="text-title">No events found</h2>
              <p className="text-text-secondary">
                Try another search or category.
              </p>
              <Button
                variant="outlined"
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
