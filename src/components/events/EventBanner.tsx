"use client";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Event } from "@/types/api";

export function EventBanner({
  event,
  className,
  priority = false,
}: {
  event: Event;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const first = event.images?.[0];
  const source = typeof first === "string" ? first : first?.url;
  const safeSource =
    source &&
    (/^https?:\/\//i.test(source) ||
      (source.startsWith("/") && !source.startsWith("//")))
      ? source
      : null;
  return (
    <div className={cn("relative overflow-hidden bg-primary/10", className)}>
      {safeSource && !failed ? (
        <Image
          src={safeSource}
          alt={typeof first === "object" && first.alt ? first.alt : event.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          unoptimized
          preload={priority}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full min-h-40 items-center justify-center bg-gradient-to-br from-primary/15 via-surface to-primary/5">
          <svg
            aria-hidden="true"
            viewBox="0 0 160 100"
            className="w-40 text-primary/60"
          >
            <path
              d="M25 25h110v18a8 8 0 000 16v18H25V59a8 8 0 000-16V25z"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              d="M110 26v50"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
            <path
              d="M47 44h42M47 58h28"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
