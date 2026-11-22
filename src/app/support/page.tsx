import { MySupport } from "@/components/support/MySupport";
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string | string[] }>;
}) {
  const { case: selected } = await searchParams;
  return (
    <MySupport initialCase={typeof selected === "string" ? selected : ""} />
  );
}
