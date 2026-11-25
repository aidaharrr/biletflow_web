import { useTranslations } from "next-intl";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
export default function Loading() {
  const t = useTranslations("organizer");
  return <LoadingSpinner label={t("loading")} />;
}
