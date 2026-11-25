import { useTranslations } from "next-intl";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
export default function Loading() {
  const t = useTranslations("events");
  return <LoadingSpinner label={t("EventLoading.label")} />;
}
