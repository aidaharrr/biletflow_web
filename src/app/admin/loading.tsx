import { useTranslations } from "next-intl";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
export default function AdminLoading() {
  const t = useTranslations("admin.layout");
  return <LoadingSpinner label={t("loadingWorkspace")} />;
}
