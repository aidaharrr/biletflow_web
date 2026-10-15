import { Card } from "./Card";
import type { ReactNode } from "react";
export function StatCard({
  label,
  value,
  helper,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className="min-w-0 space-y-md">
      <p className="text-label text-text-secondary">{label}</p>
      <p
        className={`break-words font-brand text-2xl font-semibold ${accent ? "text-primary" : "text-text-primary"}`}
      >
        {value}
      </p>
      {helper && <p className="text-label text-text-secondary">{helper}</p>}
    </Card>
  );
}
