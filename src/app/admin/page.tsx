import { redirect } from "next/navigation";
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const query = await searchParams;
  redirect(`/admin/dashboard${query.mode === "demo" ? "?mode=demo" : ""}`);
}
